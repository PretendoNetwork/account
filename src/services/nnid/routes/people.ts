import crypto from 'node:crypto';
import { Router } from 'express';
import xmlbuilder from 'xmlbuilder';
import bcrypt from 'bcrypt';
import moment from 'moment';
import deviceCertificateMiddleware from '@/middleware/device-certificate';
import ratelimit from '@/middleware/ratelimit';
import database from '@/database';
import util from '@/util';
import { PNID } from '@/models/pnid';
import { NEXAccount } from '@/models/nex-account';
import logger from '@/logger';
import timezones from '@/services/nnid/timezones.json';

const router = Router();

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/people/:USERNAME
 * Description: Checks if a username is in use
 */
router.get('/:username', async (request, response) => {
	const { username } = request.params;

	const userExists = await database.doesUserExist(username);

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
router.post('/', ratelimit, deviceCertificateMiddleware, async (request, response) => {
	if (!request.certificate.valid) {
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

	const person = request.body.get('person');

	const userExists = await database.doesUserExist(person.get('user_id'));

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

	const creationDate = moment().format('YYYY-MM-DDTHH:MM:SS');
	let pnid;
	let nexAccount;

	const session = await database.connection().startSession();
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

		const primaryPasswordHash = util.nintendoPasswordHash(person.get('password'), nexAccount.get('pid'));
		const passwordHash = await bcrypt.hash(primaryPasswordHash, 10);

		const countryCode = person.get('country');
		const language = person.get('language');
		const timezoneName = person.get('tz_name');

		const regionLanguages = timezones[countryCode];
		const regionTimezones = regionLanguages[language] ? regionLanguages[language] : Object.values(regionLanguages)[0];
		const timezone = regionTimezones.find(tz => tz.area === timezoneName);

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
		logger.error('[POST] /v1/api/people: ' + error);

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

	await util.sendConfirmationEmail(pnid);

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
router.get('/@me/profile', async (request, response) => {
	response.set('Content-Type', 'text/xml');
	response.set('Server', 'Nintendo 3DS (http)');
	response.set('X-Nintendo-Date', new Date().getTime().toString());

	const { pnid } = request;

	const person = await database.getUserProfileJSONByPID(pnid.get('pid'));

	response.send(xmlbuilder.create({
		person
	}, { separateArrayItems: true }).end());
});

/**
 * [POST]
 * Replacement for: https://account.nintendo.net/v1/api/people/@me/devices
 * Description: Gets user profile, seems to be the same as https://account.nintendo.net/v1/api/people/@me/profile
 */
router.post('/@me/devices', async (request, response) => {
	response.set('Content-Type', 'text/xml');
	response.set('Server', 'Nintendo 3DS (http)');
	response.set('X-Nintendo-Date', new Date().getTime().toString());

	// We don't care about the device attributes
	// The console ignores them and PNIDs are not tied to consoles anyway
	// So the server also ignores them and does not save the ones posted here

	const { pnid } = request;

	const person = await database.getUserProfileJSONByPID(pnid.pid);

	response.send(xmlbuilder.create({
		person
	}).end());
});

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/people/@me/devices
 * Description: Returns only user devices
 */
router.get('/@me/devices', async (request, response) => {
	response.set('Content-Type', 'text/xml');
	response.set('Server', 'Nintendo 3DS (http)');
	response.set('X-Nintendo-Date', new Date().getTime().toString());

	const { pnid, headers } = request;

	response.send(xmlbuilder.create({
		devices: [
			{
				device: {
					device_id: headers['x-nintendo-device-id'],
					language: headers['accept-language'],
					updated: moment().format('YYYY-MM-DDTHH:MM:SS'),
					pid: pnid.get('pid'),
					platform_id: headers['x-nintendo-platform-id'],
					region: headers['x-nintendo-region'],
					serial_number: headers['x-nintendo-serial-number'],
					status: 'ACTIVE',
					system_version: headers['x-nintendo-system-version'],
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
router.get('/@me/devices/owner', async (request, response) => {
	response.set('Content-Type', 'text/xml');
	response.set('Server', 'Nintendo 3DS (http)');
	response.set('X-Nintendo-Date', moment().add(5, 'h').toString());

	const { pnid } = request;

	const person = await database.getUserProfileJSONByPID(pnid.get('pid'));

	response.send(xmlbuilder.create({
		person
	}).end());
});

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/people/@me/devices/status
 * Description: Unknown use
 */
router.get('/@me/devices/status', async (request, response) => {
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
router.put('/@me/miis/@primary', async (request, response) => {
	const { pnid } = request;

	const mii = request.body.get('mii');

	const [name, primary, data] = [mii.get('name'), mii.get('primary'), mii.get('data')];

	await pnid.updateMii({ name, primary, data });

	response.send('');
});

/**
 * [PUT]
 * Replacement for: https://account.nintendo.net/v1/api/people/@me/devices/@current/inactivate
 * Description: Deactivates a user from a console
 */
router.put('/@me/devices/@current/inactivate', async (request, response) => {
	response.set('Server', 'Nintendo 3DS (http)');
	response.set('X-Nintendo-Date', new Date().getTime().toString());

	const { pnid } = request;

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
router.put('/@me/deletion', async (request, response) => {
	const { pnid } = request;

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
router.put('/@me', async (request, response) => {
	const { pnid } = request;
	const person = request.body.get('person');

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

	const gender = person.get('gender') ? person.get('gender') : pnid.get('gender');
	const region = person.get('region') ? person.get('region') : pnid.get('region');
	const countryCode = person.get('country') ? person.get('country') : pnid.get('country');
	const language = person.get('language') ? person.get('language') : pnid.get('language');
	const timezoneName = person.get('tz_name') ? person.get('tz_name') : pnid.get('timezone.name');
	const marketingFlag = person.get('marketing_flag') ? person.get('marketing_flag') === 'Y' : pnid.get('flags.marketing');
	const offDeviceFlag = person.get('off_device_flag') ? person.get('off_device_flag') === 'Y' : pnid.get('flags.off_device');

	const regionLanguages = timezones[countryCode];
	const regionTimezones = regionLanguages[language] ? regionLanguages[language] : Object.values(regionLanguages)[0];
	const timezone = regionTimezones.find(tz => tz.area === timezoneName);

	if (person.get('password')) {
		const primaryPasswordHash = util.nintendoPasswordHash(person.get('password'), pnid.get('pid'));
		const passwordHash = await bcrypt.hash(primaryPasswordHash, 10);

		pnid.password = passwordHash;
	}

	pnid.gender = gender;
	pnid.region = region;
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
router.get('/@me/emails', async (request, response) => {
	const { pnid } = request;

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
router.put('/@me/emails/@primary', async (request, response) => {
	const { pnid } = request;
	const email = request.body.get('email');

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

	pnid.set('email.address', email.get('address').toLowerCase());
	pnid.set('email.reachable', false);
	pnid.set('email.validated', false);
	pnid.set('email.validated_date', '');
	pnid.set('email.id', crypto.randomBytes(4).readUInt32LE());

	await pnid.generateEmailValidationCode();
	await pnid.generateEmailValidationToken();

	await pnid.save();

	await util.sendConfirmationEmail(pnid);

	response.send('');
});

export default router;