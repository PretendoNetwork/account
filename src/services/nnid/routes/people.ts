import crypto from 'node:crypto';
import express from 'express';
import xmlbuilder from 'xmlbuilder';
import bcrypt from 'bcrypt';
import moment from 'moment';
import mongoose from 'mongoose';
import deviceCertificateMiddleware from '@/middleware/device-certificate';
import ratelimit from '@/middleware/ratelimit';
import { connection as databaseConnection, doesUserExist, getUserProfileJSONByPID } from '@/database';
import { getValueFromHeaders, nintendoPasswordHash, sendConfirmationEmail } from '@/util';
import { PNID } from '@/models/pnid';
import { NEXAccount } from '@/models/nex-account';
import { LOG_ERROR } from '@/logger';

import timezones from '@/services/nnid/timezones.json';

import { HydratedPNIDDocument } from '@/types/mongoose/pnid';
import { HydratedNEXAccountDocument } from '@/types/mongoose/nex-account';
import { RegionLanguages } from '@/types/services/nnid/region-languages';
import { RegionTimezone, RegionTimezones } from '@/types/services/nnid/region-timezones';
import { Person } from '@/types/services/nnid/person';
import { PNIDProfile } from '@/types/services/nnid/pnid-profile';

const router: express.Router = express.Router();

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/people/:USERNAME
 * Description: Checks if a username is in use
 */
router.get('/:username', async (request: express.Request, response: express.Response) => {
	const username: string = request.params.username;

	const userExists: boolean = await doesUserExist(username);

	if (userExists) {
		response.status(400);

		return response.end(xmlbuilder.create({
			errors: {
				error: {
					code: '0100',
					message: 'Account ID already exists'
				}
			}
		}).end());
	}

	response.status(200);
	response.end();
});

/**
 * [POST]
 * Replacement for: https://account.nintendo.net/v1/api/people
 * Description: Registers a new NNID
 */
router.post('/', ratelimit, deviceCertificateMiddleware, async (request: express.Request, response: express.Response) => {
	if (!request.certificate || !request.certificate.valid) {
		// TODO: Change this to a different error
		response.status(400);

		return response.send(xmlbuilder.create({
			error: {
				cause: 'Bad Request',
				code: '1600',
				message: 'Unable to process request'
			}
		}).end());
	}

	// * request.body is a Map, as is request.body.person
	const person: Person = request.body.get('person');

	const userExists: boolean = await doesUserExist(person.get('user_id'));

	if (userExists) {
		response.status(400);

		return response.end(xmlbuilder.create({
			errors: {
				error: {
					code: '0100',
					message: 'Account ID already exists'
				}
			}
		}).end());
	}

	const creationDate: string = moment().format('YYYY-MM-DDTHH:MM:SS');
	let pnid: HydratedPNIDDocument;
	let nexAccount: HydratedNEXAccountDocument;

	const session: mongoose.ClientSession = await databaseConnection().startSession();
	await session.startTransaction();

	try {
		nexAccount = new NEXAccount({
			device_type: 'wiiu',
		});

		await nexAccount.generatePID();
		await nexAccount.generatePassword();

		// Quick hack to get the PIDs to match
		// TODO: Change this maybe?
		// NN with a NNID will always use the NNID PID
		// even if the provided NEX PID is different
		// To fix this we make them the same PID
		nexAccount.owning_pid = nexAccount.get('pid');

		await nexAccount.save({ session });

		const primaryPasswordHash: string = nintendoPasswordHash(person.get('password'), nexAccount.get('pid'));
		const passwordHash: string = await bcrypt.hash(primaryPasswordHash, 10);

		const countryCode: string = person.get('country');
		const language: string = person.get('language');
		const timezoneName: string = person.get('tz_name');

		const regionLanguages: RegionLanguages = timezones[countryCode as keyof typeof timezones];
		const regionTimezones: RegionTimezones = regionLanguages[language] ? regionLanguages[language] : Object.values(regionLanguages)[0];
		let timezone: RegionTimezone | undefined = regionTimezones.find(tz => tz.area === timezoneName);

		if (!timezone) {
			// TODO - Change this, handle the error
			timezone = {
				area: 'America/New_York',
				language: 'en',
				name: 'Eastern Time (US &amp; Canada)',
				order: '11',
				utc_offset: '-14400'
			};
		}

		pnid = new PNID({
			pid: nexAccount.get('pid'),
			creation_date: creationDate,
			updated: creationDate,
			username: person.get('user_id'),
			usernameLower: person.get('user_id').toLowerCase(),
			password: passwordHash,
			birthdate: person.get('birth_date'),
			gender: person.get('gender'),
			country: countryCode,
			language: language,
			email: {
				address: person.get('email').get('address').toLowerCase(),
				primary: person.get('email').get('primary') === 'Y',
				parent: person.get('email').get('parent') === 'Y',
				reachable: false,
				validated: person.get('email').get('validated') === 'Y',
				id: crypto.randomBytes(4).readUInt32LE()
			},
			region: person.get('region'),
			timezone: {
				name: timezoneName,
				offset: Number(timezone.utc_offset)
			},
			mii: {
				name: person.get('mii').get('name'),
				primary: person.get('mii').get('name') === 'Y',
				data: person.get('mii').get('data'),
				id: crypto.randomBytes(4).readUInt32LE(),
				hash: crypto.randomBytes(7).toString('hex'),
				image_url: '', // deprecated, will be removed in the future
				image_id: crypto.randomBytes(4).readUInt32LE()
			},
			flags: {
				active: true,
				marketing: person.get('marketing_flag') === 'Y',
				off_device: person.get('off_device_flag') === 'Y'
			},
			identification: {
				email_code: 1, // will be overwritten before saving
				email_token: '' // will be overwritten before saving
			}
		});

		await pnid.generateEmailValidationCode();
		await pnid.generateEmailValidationToken();
		await pnid.generateMiiImages();

		await pnid.save({ session });

		await session.commitTransaction();
	} catch (error) {
		LOG_ERROR('[POST] /v1/api/people: ' + error);

		await session.abortTransaction();

		response.status(400);

		return response.send(xmlbuilder.create({
			error: {
				cause: 'Bad Request',
				code: '1600',
				message: 'Unable to process request'
			}
		}).end());
	} finally {
		// * This runs regardless of failure
		// * Returning on catch will not prevent this from running
		await session.endSession();
	}

	await sendConfirmationEmail(pnid);

	response.send(xmlbuilder.create({
		person: {
			pid: pnid.get('pid')
		}
	}).end());
});

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/people/@me/profile
 * Description: Gets a users profile
 */
router.get('/@me/profile', async (request: express.Request, response: express.Response) => {
	response.set('Content-Type', 'text/xml');
	response.set('Server', 'Nintendo 3DS (http)');
	response.set('X-Nintendo-Date', new Date().getTime().toString());

	const pnid: HydratedPNIDDocument | null = request.pnid;

	if (!pnid) {
		// TODO - Research this error more
		return response.status(404).send(xmlbuilder.create({
			errors: {
				error: {
					cause: '',
					code: '0008',
					message: 'Not Found'
				}
			}
		}).end());
	}

	const person: PNIDProfile | null = await getUserProfileJSONByPID(pnid.get('pid'));

	if (!person) {
		// TODO - Research this error more
		return response.status(404).send(xmlbuilder.create({
			errors: {
				error: {
					cause: '',
					code: '0008',
					message: 'Not Found'
				}
			}
		}).end());
	}

	response.send(xmlbuilder.create({
		person
	}, { separateArrayItems: true }).end());
});

/**
 * [POST]
 * Replacement for: https://account.nintendo.net/v1/api/people/@me/devices
 * Description: Gets user profile, seems to be the same as https://account.nintendo.net/v1/api/people/@me/profile
 */
router.post('/@me/devices', async (request: express.Request, response: express.Response) => {
	response.set('Content-Type', 'text/xml');
	response.set('Server', 'Nintendo 3DS (http)');
	response.set('X-Nintendo-Date', new Date().getTime().toString());

	// We don't care about the device attributes
	// The console ignores them and PNIDs are not tied to consoles anyway
	// So the server also ignores them and does not save the ones posted here

	// TODO - CHANGE THIS. WE NEED TO SAVE CONSOLE DETAILS !!!

	const pnid: HydratedPNIDDocument | null = request.pnid;

	if (!pnid) {
		// TODO - Research this error more
		return response.status(404).send(xmlbuilder.create({
			errors: {
				error: {
					cause: '',
					code: '0008',
					message: 'Not Found'
				}
			}
		}).end());
	}

	const person: PNIDProfile | null = await getUserProfileJSONByPID(pnid.get('pid'));

	if (!person) {
		// TODO - Research this error more
		return response.status(404).send(xmlbuilder.create({
			errors: {
				error: {
					cause: '',
					code: '0008',
					message: 'Not Found'
				}
			}
		}).end());
	}

	response.send(xmlbuilder.create({
		person
	}).end());
});

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/people/@me/devices
 * Description: Returns only user devices
 */
router.get('/@me/devices', async (request: express.Request, response: express.Response) => {
	response.set('Content-Type', 'text/xml');
	response.set('Server', 'Nintendo 3DS (http)');
	response.set('X-Nintendo-Date', new Date().getTime().toString());

	const pnid: HydratedPNIDDocument | null = request.pnid;
	const deviceId: string | undefined = getValueFromHeaders(request.headers, 'x-nintendo-device-id');
	const acceptLanguage: string | undefined = getValueFromHeaders(request.headers, 'accept-language');
	const platformId: string | undefined = getValueFromHeaders(request.headers, 'x-nintendo-platform-id');
	const region: string | undefined = getValueFromHeaders(request.headers, 'x-nintendo-region');
	const serialNumber: string | undefined = getValueFromHeaders(request.headers, 'x-nintendo-serial-number');
	const systemVersion: string | undefined = getValueFromHeaders(request.headers, 'x-nintendo-system-version');

	if (!deviceId || !acceptLanguage || !platformId || !region || !serialNumber || !systemVersion) {
		// TODO - Research these error more
		return response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'Bad Request',
					code: '1600',
					message: 'Unable to process request'
				}
			}
		}).end());
	}

	if (!pnid) {
		// TODO - Research this error more
		return response.status(404).send(xmlbuilder.create({
			errors: {
				error: {
					cause: '',
					code: '0008',
					message: 'Not Found'
				}
			}
		}).end());
	}

	response.send(xmlbuilder.create({
		devices: [
			{
				device: {
					device_id: deviceId,
					language: acceptLanguage,
					updated: moment().format('YYYY-MM-DDTHH:MM:SS'),
					pid: pnid.get('pid'),
					platform_id: platformId,
					region: region,
					serial_number: serialNumber,
					status: 'ACTIVE',
					system_version: systemVersion,
					type: 'RETAIL',
					updated_by: 'USER'
				}
			}
		]
	}).end());
});

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/people/@me/devices/owner
 * Description: Gets user profile, seems to be the same as https://account.nintendo.net/v1/api/people/@me/profile
 */
router.get('/@me/devices/owner', async (request: express.Request, response: express.Response) => {
	response.set('Content-Type', 'text/xml');
	response.set('Server', 'Nintendo 3DS (http)');
	response.set('X-Nintendo-Date', moment().add(5, 'h').toString());

	const pnid: HydratedPNIDDocument | null = request.pnid;

	if (!pnid) {
		// TODO - Research this error more
		return response.status(404).send(xmlbuilder.create({
			errors: {
				error: {
					cause: '',
					code: '0008',
					message: 'Not Found'
				}
			}
		}).end());
	}

	const person: PNIDProfile | null = await getUserProfileJSONByPID(pnid.get('pid'));

	if (!person) {
		// TODO - Research this error more
		return response.status(404).send(xmlbuilder.create({
			errors: {
				error: {
					cause: '',
					code: '0008',
					message: 'Not Found'
				}
			}
		}).end());
	}

	response.send(xmlbuilder.create({
		person
	}).end());
});

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/people/@me/devices/status
 * Description: Unknown use
 */
router.get('/@me/devices/status', async (_request: express.Request, response: express.Response) => {
	response.set('Content-Type', 'text/xml');
	response.set('Server', 'Nintendo 3DS (http)');
	response.set('X-Nintendo-Date', moment().add(5, 'h').toString());

	response.send(xmlbuilder.create({
		device: {}
	}).end());
});


/**
 * [PUT]
 * Replacement for: https://account.nintendo.net/v1/api/people/@me/miis/@primary
 * Description: Updates a users Mii
 */
router.put('/@me/miis/@primary', async (request: express.Request, response: express.Response) => {
	const pnid: HydratedPNIDDocument | null = request.pnid;

	if (!pnid) {
		// TODO - Research this error more
		return response.status(404).send(xmlbuilder.create({
			errors: {
				error: {
					cause: '',
					code: '0008',
					message: 'Not Found'
				}
			}
		}).end());
	}

	// TODO - Make this more strictly typed?
	const mii: Map<string, string> = request.body.get('mii');

	// TODO - Better checks

	const name: string | undefined = mii.get('name') || '';
	const primary: string | undefined = mii.get('primary') || '';
	const data: string | undefined = mii.get('data') || '';

	await pnid.updateMii({ name, primary, data });

	response.send('');
});

/**
 * [PUT]
 * Replacement for: https://account.nintendo.net/v1/api/people/@me/devices/@current/inactivate
 * Description: Deactivates a user from a console
 */
router.put('/@me/devices/@current/inactivate', async (request: express.Request, response: express.Response) => {
	response.set('Server', 'Nintendo 3DS (http)');
	response.set('X-Nintendo-Date', new Date().getTime().toString());

	const pnid: HydratedPNIDDocument | null = request.pnid;

	if (!pnid) {
		response.status(400);

		return response.end(xmlbuilder.create({
			errors: {
				error: {
					cause: 'access_token',
					code: '0002',
					message: 'Invalid access token'
				}
			}
		}).end());
	}

	response.status(200);
	response.end();
});

/**
 * [POST]
 * Replacement for: https://account.nintendo.net/v1/api/people/@me/deletion
 * Description: Deletes a NNID
 */
router.put('/@me/deletion', async (request: express.Request, response: express.Response) => {
	const pnid: HydratedPNIDDocument | null = request.pnid;

	if (!pnid) {
		response.status(400);

		return response.end(xmlbuilder.create({
			errors: {
				error: {
					cause: 'access_token',
					code: '0002',
					message: 'Invalid access token'
				}
			}
		}).end());
	}

	response.send('');
});

/**
 * [PUT]
 * Replacement for: https://account.nintendo.net/v1/api/people/@me/
 * Description: Updates a PNIDs account details
 */
router.put('/@me', async (request: express.Request, response: express.Response) => {
	const pnid: HydratedPNIDDocument | null = request.pnid;
	const person: Person = request.body.get('person');

	if (!pnid) {
		response.status(400);

		return response.end(xmlbuilder.create({
			errors: {
				error: {
					cause: 'access_token',
					code: '0002',
					message: 'Invalid access token'
				}
			}
		}).end());
	}

	const gender: string = person.get('gender') ? person.get('gender') : pnid.get('gender');
	const region: string = person.get('region') ? person.get('region') : pnid.get('region');
	const countryCode: string = person.get('country') ? person.get('country') : pnid.get('country');
	const language: string = person.get('language') ? person.get('language') : pnid.get('language');
	const timezoneName: string = person.get('tz_name') ? person.get('tz_name') : pnid.get('timezone.name');
	const marketingFlag: boolean = person.get('marketing_flag') ? person.get('marketing_flag') === 'Y' : pnid.get('flags.marketing');
	const offDeviceFlag: boolean = person.get('off_device_flag') ? person.get('off_device_flag') === 'Y' : pnid.get('flags.off_device');

	const regionLanguages: RegionLanguages = timezones[countryCode as keyof typeof timezones];
	const regionTimezones: RegionTimezones = regionLanguages[language] ? regionLanguages[language] : Object.values(regionLanguages)[0];
	let timezone: RegionTimezone | undefined = regionTimezones.find(tz => tz.area === timezoneName);

	if (!timezone) {
		// TODO - Change this, handle the error
		timezone = {
			area: 'America/New_York',
			language: 'en',
			name: 'Eastern Time (US &amp; Canada)',
			order: '11',
			utc_offset: '-14400'
		};
	}

	if (person.get('password')) {
		const primaryPasswordHash: string = nintendoPasswordHash(person.get('password'), pnid.get('pid'));
		const passwordHash: string = await bcrypt.hash(primaryPasswordHash, 10);

		pnid.password = passwordHash;
	}

	pnid.gender = gender;
	pnid.region = Number(region);
	pnid.timezone.name = timezoneName;
	pnid.timezone.offset = Number(timezone.utc_offset);
	pnid.timezone.marketing = marketingFlag;
	pnid.timezone.off_device = offDeviceFlag;

	await pnid.save();

	response.send('');
});

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/people/@me/emails/
 * Description: Gets a list (why?) of PNID emails
 */
router.get('/@me/emails', async (request: express.Request, response: express.Response) => {
	const pnid: HydratedPNIDDocument | null = request.pnid;

	if (!pnid) {
		response.status(400);

		return response.end(xmlbuilder.create({
			errors: {
				error: {
					cause: 'access_token',
					code: '0002',
					message: 'Invalid access token'
				}
			}
		}).end());
	}

	response.send(xmlbuilder.create({
		emails: [
			{
				email: {
					address: pnid.get('email.address'),
					id: pnid.get('email.id'),
					parent: pnid.get('email.parent') ? 'Y' : 'N',
					primary: pnid.get('email.primary') ? 'Y' : 'N',
					reachable: pnid.get('email.reachable') ? 'Y' : 'N',
					type: 'DEFAULT', // what is this?
					updated_by: 'USER', // need to actually update this
					validated: pnid.get('email.validated') ? 'Y' : 'N',
					validated_date: pnid.get('email.validated_date'),
				}
			}
		]
	}).end());
});

/**
 * [PUT]
 * Replacement for: https://account.nintendo.net/v1/api/people/@me/emails/@primary
 * Description: Updates a users email address
 */
router.put('/@me/emails/@primary', async (request: express.Request, response: express.Response) => {
	const pnid: HydratedPNIDDocument | null = request.pnid;

	// TODO - Make this more strictly typed?
	const email: Map<string, string> = request.body.get('email');

	if (!pnid || !email) {
		response.status(400);

		return response.end(xmlbuilder.create({
			errors: {
				error: {
					cause: 'access_token',
					code: '0002',
					message: 'Invalid access token'
				}
			}
		}).end());
	}

	// TODO - Better email check
	pnid.set('email.address', (email.get('address') || '').toLowerCase());
	pnid.set('email.reachable', false);
	pnid.set('email.validated', false);
	pnid.set('email.validated_date', '');
	pnid.set('email.id', crypto.randomBytes(4).readUInt32LE());

	await pnid.generateEmailValidationCode();
	await pnid.generateEmailValidationToken();

	await pnid.save();

	await sendConfirmationEmail(pnid);

	response.send('');
});

export default router;