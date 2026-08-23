import crypto from 'node:crypto';
import express from 'express';
import xmlbuilder from 'xmlbuilder';
import bcrypt from 'bcrypt';
import moment from 'moment';
import Mii from 'mii-js';
import deviceCertificateMiddleware from '@/middleware/device-certificate';
import { deviceRatelimit } from '@/middleware/ratelimit';
import { connection as databaseConnection, doesPNIDExist, getPNIDProfileJSONByPID } from '@/database';
import { isValidBirthday, getAgeFromDate, isObject, getValueFromHeaders, nintendoPasswordHash, sendConfirmationEmail, sendPNIDDeletedEmail } from '@/util';
import IP2LocationManager from '@/ip2location';
import { PNID } from '@/models/pnid';
import { NEXAccount } from '@/models/nex-account';
import { LOG_ERROR } from '@/logger';
import timezones from '@/services/nnas/timezones.json';
import regions from '@/services/nnas/regions.json';
import type { HydratedPNIDDocument } from '@/types/mongoose/pnid';
import type { HydratedNEXAccountDocument } from '@/types/mongoose/nex-account';
import type { Person } from '@/types/services/nnas/person';

const PNID_VALID_CHARACTERS_REGEX = /^[\w\-.]*$/;
const PNID_PUNCTUATION_START_REGEX = /^[_\-.]/;
const PNID_PUNCTUATION_END_REGEX = /[_\-.]$/;
const PNID_PUNCTUATION_DUPLICATE_REGEX = /[_\-.]{2,}/;

// * This sucks
const PASSWORD_WORD_OR_NUMBER_REGEX = /(?=.*[a-zA-Z])(?=.*\d).*/;
const PASSWORD_WORD_OR_PUNCTUATION_REGEX = /(?=.*[a-zA-Z])(?=.*[_\-.]).*/;
const PASSWORD_NUMBER_OR_PUNCTUATION_REGEX = /(?=.*\d)(?=.*[_\-.]).*/;
const PASSWORD_REPEATED_CHARACTER_REGEX = /(.)\1\1/;

// * Taken from https://github.com/cemu-project/Cemu/blob/5ead58008dd984f614e2cb38bd9cb69bd77fd1bb/src/Cemu/ncrypto/ncrypto.cpp#L825
// * which Cemu uses to build it's AuthInfo struct, which is what is used to populate the X-Nintendo-Country header.
// * This header uses the same values as the "country" field in the NNID account data. Assumed to be correct
const ALLOWED_ACCOUNT_COUNTRIES = [
	'JP',
	'AI',
	'AG',
	'AR',
	'AW',
	'BS',
	'BB',
	'BZ',
	'BO',
	'BR',
	'VG',
	'CA',
	'KY',
	'CL',
	'CO',
	'CR',
	'DM',
	'DO',
	'EC',
	'SV',
	'GF',
	'GD',
	'GP',
	'GT',
	'GY',
	'HT',
	'HN',
	'JM',
	'MQ',
	'MX',
	'MS',
	'AN',
	'NI',
	'PA',
	'PY',
	'PE',
	'KN',
	'LC',
	'VC',
	'SR',
	'TT',
	'TC',
	'US',
	'UY',
	'VI',
	'VE',
	'AL',
	'AU',
	'AT',
	'BE',
	'BA',
	'BW',
	'BG',
	'HR',
	'CY',
	'CZ',
	'DK',
	'EE',
	'FI',
	'FR',
	'DE',
	'GR',
	'HU',
	'IS',
	'IE',
	'IT',
	'LV',
	'LS',
	'LI',
	'LT',
	'LU',
	'MK',
	'MT',
	'ME',
	'MZ',
	'NA',
	'NL',
	'NZ',
	'NO',
	'PL',
	'PT',
	'RO',
	'RU',
	'RS',
	'SK',
	'SI',
	'ZA',
	'ES',
	'SZ',
	'SE',
	'CH',
	'TR',
	'GB',
	'ZM',
	'ZW',
	'AZ',
	'MR',
	'ML',
	'NE',
	'TD',
	'SD',
	'ER',
	'DJ',
	'SO',
	'AD',
	'GI',
	'GG',
	'IM',
	'JE',
	'MC',
	'TW',
	'KR',
	'HK',
	'MO',
	'ID',
	'SG',
	'TH',
	'PH',
	'MY',
	'CN',
	'AE',
	'EG',
	'OM',
	'QA',
	'KW',
	'SA',
	'SY',
	'BH',
	'JO',
	'SM',
	'VA',
	'BM',
	'IN',
	'NG',
	'AO',
	'GH'
];

// * This SEEMS to be derived from the known languages in the timezone list,
// * which lines up with the typical set of languages we see Nintendo use
// * https://nintendo.wiki/wiki/Online/Nintendo_Network/IDBE#Languages
const ALLOWED_ACCOUNT_LANGUAGES = [
	'ja',
	'en',
	'fr',
	'de',
	'it',
	'es',
	// * Likely simplified Chinese, but we haven't seen this in practice
	// * Likely Korean, but we haven't seen this in practice
	'nl',
	'pt',
	'ru'
	// * Likely traditional Chinese, but we haven't seen this in practice
];

const router = express.Router();

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/people/:USERNAME
 * Description: Checks if a username is in use
 */
router.get('/:username', async (request: express.Request, response: express.Response): Promise<void> => {
	const username = request.params.username;

	const userExists = await doesPNIDExist(username);

	if (userExists) {
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					code: '0100',
					message: 'Account ID already exists'
				}
			}
		}).end());

		return;
	}

	response.send();
});

/**
 * [POST]
 * Replacement for: https://account.nintendo.net/v1/api/people
 * Description: Registers a new NNID
 */
router.post('/', deviceRatelimit, deviceCertificateMiddleware, async (request: express.Request, response: express.Response): Promise<void> => {
	if (!request.certificate || !request.certificate.valid) {
		// TODO - Change this to a different error
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'Bad Request',
					code: '1600',
					message: 'Unable to process request'
				}
			}
		}).end());

		return;
	}

	// TODO - Eventually replace this with Zod probably. Just doing the old fashioned way for now
	const person: Person = request.body.person;

	if (!person) {
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'Bad Request',
					code: '1600',
					message: 'Unable to process request'
				}
			}
		}).end());

		return;
	}

	if (!person.birth_date || !isValidBirthday(person.birth_date)) {
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'birthDate',
					code: '0002',
					message: 'birthDate format is invalid'
				}
			}
		}).end());

		return;
	}

	const age = getAgeFromDate(person.birth_date);

	if (age < 18) {
		// TODO - Enable `CF-IPCountry` in Cloudflare and only use IP2Location as a fallback
		const ip = request.ip;
		if (ip) {
			const location = IP2LocationManager.lookup(ip);
			if (location?.country === 'US' && location?.region === 'Mississippi') {
				// * See https://bsky.social/about/blog/08-22-2025-mississippi-hb1126 for details
				response.status(403).send(xmlbuilder.create({
					errors: {
						error: {
							code: '1228', // TODO - This is made up because 228 is a Mississippi area code /shrug
							message: 'Mississippi law prevents us from collecting any data from any users under the age of 18 without extreme parental verification methods.' // TODO - Translate this? It wont show to end users so maybe not though
						}
					}
				}).end());

				return;
			}
		}
	}

	if (age < 13) {
		// * Wii U firmware 5.5.6 changed NNID setup to block setup of new accounts if the users age is
		// * under 13, telling parents that they MUST call Nintendo to create the account, and we trusted
		// * that users would be on these firmwares. Lower firmwares won't have this though, and will use
		// * the old "COPPA approval" system
		// *
		// * Just block it all the time though, we don't want to deal with this headache
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					code: '0114',
					message: 'COPPA approval is not complete'
				}
			}
		}).end());

		return;
	}

	// TODO - Centralize this somewhere. Currently these same checks are being done in the gRPC and API service as well
	if (!person.user_id) {
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'userId',
					code: '1104',
					message: 'User ID format is not valid'
				}
			}
		}).end());

		return;
	}

	if (!PNID_VALID_CHARACTERS_REGEX.test(person.user_id)) {
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'userId',
					code: '1104',
					message: 'User ID format is not valid'
				}
			}
		}).end());

		return;
	}

	if (PNID_PUNCTUATION_START_REGEX.test(person.user_id)) {
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'userId',
					code: '1104',
					message: 'User ID format is not valid'
				}
			}
		}).end());

		return;
	}

	if (PNID_PUNCTUATION_END_REGEX.test(person.user_id)) {
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'userId',
					code: '1104',
					message: 'User ID format is not valid'
				}
			}
		}).end());

		return;
	}

	if (PNID_PUNCTUATION_DUPLICATE_REGEX.test(person.user_id)) {
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'userId',
					code: '1104',
					message: 'User ID format is not valid'
				}
			}
		}).end());

		return;
	}

	const userExists = await doesPNIDExist(person.user_id);

	if (userExists) {
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'userId',
					code: '0100',
					message: 'Account ID already exists'
				}
			}
		}).end());

		return;
	}

	// TODO - Check username for blacklisted words. See https://github.com/PretendoNetwork/ngword
	// * if (usernameIsBad) {
	// * 	response.status(400).send(xmlbuilder.create({
	// * 		errors: {
	// * 			error: {
	// * 				cause: 'userId',
	// * 				code: '0101',
	// * 				message: 'Account ID is not acceptable'
	// * 			}
	// * 		}
	// * 	}).end());
	// *
	// * 	return;
	// * }

	// TODO - Centralize this somewhere, all the same error
	if (!person.password) {
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'password',
					code: '0002',
					message: 'password format is invalid'
				}
			}
		}).end());

		return;
	}

	if (person.password.length < 6 || person.password.length > 16) {
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'password',
					code: '0002',
					message: 'password format is invalid'
				}
			}
		}).end());

		return;
	}

	if (!PASSWORD_WORD_OR_NUMBER_REGEX.test(person.password) && !PASSWORD_WORD_OR_PUNCTUATION_REGEX.test(person.password) && !PASSWORD_NUMBER_OR_PUNCTUATION_REGEX.test(person.password)) {
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'password',
					code: '0002',
					message: 'password format is invalid'
				}
			}
		}).end());

		return;
	}

	if (PASSWORD_REPEATED_CHARACTER_REGEX.test(person.password)) {
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'password',
					code: '0002',
					message: 'password format is invalid'
				}
			}
		}).end());

		return;
	}

	if (person.password.toLowerCase() === person.user_id.toLowerCase()) {
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'password',
					code: '1107',
					message: 'Password cannot be the same as User ID'
				}
			}
		}).end());

		return;
	}

	if (!person.country || !ALLOWED_ACCOUNT_COUNTRIES.includes(person.country)) {
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'country',
					code: '0002',
					message: 'country format is invalid'
				}
			}
		}).end());

		return;
	}

	// TODO - I think region locking is a stupid idea here, but in case we ever want it here it is
	// * if (person.country does not match console country header/etc.) {
	// * 	response.status(400).send(xmlbuilder.create({
	// * 		errors: {
	// * 			error: {
	// * 				code: '0107',
	// * 				message: 'Account country and device country do not match'
	// * 			}
	// * 		}
	// * 	}).end());
	// *
	// * 	return;
	// * }

	if (!person.language || !ALLOWED_ACCOUNT_LANGUAGES.includes(person.language)) {
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'language',
					code: '0002',
					message: 'language format is invalid'
				}
			}
		}).end());

		return;
	}

	if (!person.tz_name) {
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'timezone',
					code: '0002',
					message: 'language format is invalid'
				}
			}
		}).end());

		return;
	}

	// TODO - Do we want to check if the timezone valid here? That kinda already gets handled below

	if (!person.email || !isObject(person.email)) {
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'email',
					code: '0103',
					message: 'Email format is invalid'
				}
			}
		}).end());

		return;
	}

	// TODO - I could not care less about doing proper email validation ngl. I'm not touching that nightmare right now
	if (!person.email.address || !person.email.address.includes('@')) {
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'address',
					code: '0103',
					message: 'Email format is invalid'
				}
			}
		}).end());

		return;
	}

	if (!person.gender || !(['M', 'F'].includes(person.gender))) {
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'gender',
					code: '0002',
					message: 'gender format is invalid'
				}
			}
		}).end());

		return;
	}

	if (!person.region) {
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'region',
					code: '0002',
					message: 'region format is invalid'
				}
			}
		}).end());

		return;
	}

	// * Not bothering with a NaN check here because the loop catches that, NaN will never match
	const targetRegion = Number(person.region);
	let validRegion = false;

	countryLoop: for (const country of regions) {
		for (const region of country.regions) {
			if (region.id === targetRegion) {
				validRegion = true;

				break countryLoop;
			}
		}
	}

	if (!validRegion) {
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'region',
					code: '0002',
					message: 'region format is invalid'
				}
			}
		}).end());

		return;
	}

	if (!person.marketing_flag || !(['Y', 'N'].includes(person.marketing_flag))) {
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'marketingFlag',
					code: '0002',
					message: 'marketingFlag format is invalid'
				}
			}
		}).end());

		return;
	}

	// * This is what the official server does, I don't have a proper error code here so I'm just emulating.
	// * I know this isn't what our server would actually do
	if (!person.mii || !isObject(person.mii)) {
		response.status(500).send('HV000028: Unexpected exception during isValid call.').end();

		return;
	}

	// TODO - I don't actually know the rules of Mii names outside of the character limit? Figure that out and add them here
	if (!person.mii.name || person.mii.name.length > 10) {
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'miiName',
					code: '0002',
					message: 'miiName format is invalid'
				}
			}
		}).end());

		return;
	}

	if (!person.mii.data) {
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'data',
					code: '0002',
					message: 'data format is invalid'
				}
			}
		}).end());

		return;
	}

	try {
		// * This runs the decode and validate functions internally, so we just need to catch the potential error
		new Mii(person.mii.data);
	} catch {
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'data',
					code: '0002',
					message: 'data format is invalid'
				}
			}
		}).end());

		return;
	}

	const creationDate = moment().format('YYYY-MM-DDTHH:MM:SS');
	let pnid: HydratedPNIDDocument;
	let nexAccount: HydratedNEXAccountDocument;

	const session = await databaseConnection().startSession();
	await session.startTransaction();

	try {
		nexAccount = new NEXAccount({
			device_type: 'wiiu'
		});

		await nexAccount.generatePID();
		await nexAccount.generatePassword();

		// * Quick hack to get the PIDs to match
		// TODO - Change this maybe?
		// * NN with a NNID will always use the NNID PID
		// * even if the provided NEX PID is different
		// * To fix this we make them the same PID
		nexAccount.owning_pid = nexAccount.pid;

		await nexAccount.save({ session });

		const primaryPasswordHash = nintendoPasswordHash(person.password, nexAccount.pid);
		const passwordHash = await bcrypt.hash(primaryPasswordHash, 10);

		const countryCode = person.country;
		const language = person.language;
		const timezoneName = person.tz_name;

		const regionLanguages = timezones[countryCode as keyof typeof timezones];
		const regionTimezones = regionLanguages[language as keyof typeof regionLanguages] ? regionLanguages[language as keyof typeof regionLanguages] : Object.values(regionLanguages)[0];
		let timezone = regionTimezones.find(tz => tz.area === timezoneName);

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
			pid: nexAccount.pid,
			creation_date: creationDate,
			updated: creationDate,
			username: person.user_id,
			usernameLower: person.user_id.toLowerCase(),
			password: passwordHash,
			birthdate: person.birth_date,
			gender: person.gender,
			country: countryCode,
			language: language,
			email: {
				address: person.email.address.toLowerCase(),
				primary: person.email.primary === 'Y',
				parent: person.email.parent === 'Y',
				reachable: false,
				validated: person.email.validated === 'Y',
				id: crypto.randomBytes(4).readUInt32LE()
			},
			region: person.region,
			timezone: {
				name: timezoneName,
				offset: Number(timezone.utc_offset)
			},
			mii: {
				name: person.mii.name,
				primary: person.mii.name === 'Y',
				data: person.mii.data,
				id: crypto.randomBytes(4).readUInt32LE(),
				hash: crypto.randomBytes(7).toString('hex'),
				image_url: '', // * deprecated, will be removed in the future
				image_id: crypto.randomBytes(4).readUInt32LE()
			},
			flags: {
				active: true,
				marketing: person.marketing_flag === 'Y',
				off_device: person.off_device_flag === 'Y'
			},
			identification: {
				email_code: 1, // * will be overwritten before saving
				email_token: '' // * will be overwritten before saving
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

		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'Bad Request',
					code: '1600',
					message: 'Unable to process request'
				}
			}
		}).end());

		return;
	} finally {
		// * This runs regardless of failure
		// * Returning on catch will not prevent this from running
		await session.endSession();
	}

	await sendConfirmationEmail(pnid);

	response.send(xmlbuilder.create({
		person: {
			pid: pnid.pid
		}
	}).end());
});

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/people/@me/profile
 * Description: Gets a users profile
 */
router.get('/@me/profile', async (request: express.Request, response: express.Response): Promise<void> => {
	response.set('Content-Type', 'text/xml');
	response.set('Server', 'Nintendo 3DS (http)');
	response.set('X-Nintendo-Date', new Date().getTime().toString());

	const pnid = request.pnid;

	if (!pnid) {
		// TODO - Research this error more
		response.status(404).send(xmlbuilder.create({
			errors: {
				error: {
					cause: '',
					code: '0008',
					message: 'Not Found'
				}
			}
		}).end());

		return;
	}

	const person = await getPNIDProfileJSONByPID(pnid.pid);

	if (!person) {
		// TODO - Research this error more
		response.status(404).send(xmlbuilder.create({
			errors: {
				error: {
					cause: '',
					code: '0008',
					message: 'Not Found'
				}
			}
		}).end());

		return;
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
router.post('/@me/devices', async (request: express.Request, response: express.Response): Promise<void> => {
	response.set('Content-Type', 'text/xml');
	response.set('Server', 'Nintendo 3DS (http)');
	response.set('X-Nintendo-Date', new Date().getTime().toString());

	// * We don't care about the device attributes
	// * The console ignores them and PNIDs are not tied to consoles anyway
	// * So the server also ignores them and does not save the ones posted here

	// TODO - CHANGE THIS. WE NEED TO SAVE CONSOLE DETAILS !!!

	const pnid = request.pnid;

	if (!pnid) {
		// TODO - Research this error more
		response.status(404).send(xmlbuilder.create({
			errors: {
				error: {
					cause: '',
					code: '0008',
					message: 'Not Found'
				}
			}
		}).end());

		return;
	}

	const person = await getPNIDProfileJSONByPID(pnid.pid);

	if (!person) {
		// TODO - Research this error more
		response.status(404).send(xmlbuilder.create({
			errors: {
				error: {
					cause: '',
					code: '0008',
					message: 'Not Found'
				}
			}
		}).end());

		return;
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
router.get('/@me/devices', async (request: express.Request, response: express.Response): Promise<void> => {
	response.set('Content-Type', 'text/xml');
	response.set('Server', 'Nintendo 3DS (http)');
	response.set('X-Nintendo-Date', new Date().getTime().toString());

	const pnid = request.pnid;
	const deviceID = getValueFromHeaders(request.headers, 'x-nintendo-device-id');
	const acceptLanguage = getValueFromHeaders(request.headers, 'accept-language');
	const platformID = getValueFromHeaders(request.headers, 'x-nintendo-platform-id');
	const region = getValueFromHeaders(request.headers, 'x-nintendo-region');
	const serialNumber = getValueFromHeaders(request.headers, 'x-nintendo-serial-number');
	const systemVersion = getValueFromHeaders(request.headers, 'x-nintendo-system-version');

	if (!deviceID || !acceptLanguage || !platformID || !region || !serialNumber || !systemVersion) {
		// TODO - Research these error more
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'Bad Request',
					code: '1600',
					message: 'Unable to process request'
				}
			}
		}).end());

		return;
	}

	if (!pnid) {
		// TODO - Research this error more
		response.status(404).send(xmlbuilder.create({
			errors: {
				error: {
					cause: '',
					code: '0008',
					message: 'Not Found'
				}
			}
		}).end());

		return;
	}

	response.send(xmlbuilder.create({
		devices: [
			{
				device: {
					device_id: deviceID,
					language: acceptLanguage,
					updated: moment().format('YYYY-MM-DDTHH:MM:SS'),
					pid: pnid.pid,
					platform_id: platformID,
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
router.get('/@me/devices/owner', async (request: express.Request, response: express.Response): Promise<void> => {
	response.set('Content-Type', 'text/xml');
	response.set('Server', 'Nintendo 3DS (http)');
	response.set('X-Nintendo-Date', moment().add(5, 'h').toString());

	const pnid = request.pnid;

	if (!pnid) {
		// TODO - Research this error more
		response.status(404).send(xmlbuilder.create({
			errors: {
				error: {
					cause: '',
					code: '0008',
					message: 'Not Found'
				}
			}
		}).end());

		return;
	}

	const person = await getPNIDProfileJSONByPID(pnid.pid);

	if (!person) {
		// TODO - Research this error more
		response.status(404).send(xmlbuilder.create({
			errors: {
				error: {
					cause: '',
					code: '0008',
					message: 'Not Found'
				}
			}
		}).end());

		return;
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
router.get('/@me/devices/status', async (_request: express.Request, response: express.Response): Promise<void> => {
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
router.put('/@me/miis/@primary', async (request: express.Request, response: express.Response): Promise<void> => {
	const pnid = request.pnid;

	if (!pnid) {
		// TODO - Research this error more
		response.status(404).send(xmlbuilder.create({
			errors: {
				error: {
					cause: '',
					code: '0008',
					message: 'Not Found'
				}
			}
		}).end());

		return;
	}

	const mii: {
		name: string;
		primary: string;
		data: string;
	} = request.body.mii;

	// TODO - Better checks

	const name = mii.name;
	const primary = mii.primary;
	const data = mii.data;

	await pnid.updateMii({ name, primary, data });

	response.send('');
});

/**
 * [PUT]
 * Replacement for: https://account.nintendo.net/v1/api/people/@me/devices/@current/inactivate
 * Description: Deactivates a user from a console
 */
router.put('/@me/devices/@current/inactivate', async (request: express.Request, response: express.Response): Promise<void> => {
	response.set('Server', 'Nintendo 3DS (http)');
	response.set('X-Nintendo-Date', new Date().getTime().toString());

	const pnid = request.pnid;

	if (!pnid) {
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'access_token',
					code: '0002',
					message: 'Invalid access token'
				}
			}
		}).end());

		return;
	}

	response.send();
});

/**
 * [POST]
 * Replacement for: https://account.nintendo.net/v1/api/people/@me/deletion
 * Description: Deletes a NNID
 */
router.post('/@me/deletion', async (request: express.Request, response: express.Response): Promise<void> => {
	const pnid = request.pnid;

	if (!pnid) {
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'access_token',
					code: '0002',
					message: 'Invalid access token'
				}
			}
		}).end());

		return;
	}

	const email = pnid.email.address;

	await pnid.markForDeletion();

	try {
		await sendPNIDDeletedEmail(email, pnid.username);
	} catch (error) {
		LOG_ERROR(`Error sending deletion email ${error}`);
	}

	response.send('');
});

/**
 * [PUT]
 * Replacement for: https://account.nintendo.net/v1/api/people/@me/
 * Description: Updates a PNIDs account details
 */
router.put('/@me', async (request: express.Request, response: express.Response): Promise<void> => {
	const pnid = request.pnid;
	const person: Person = request.body.person;

	if (!pnid) {
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'access_token',
					code: '0002',
					message: 'Invalid access token'
				}
			}
		}).end());

		return;
	}

	const gender = person.gender ? person.gender : pnid.gender;
	const region = person.region ? person.region : pnid.region;
	const countryCode = person.country ? person.country : pnid.country;
	const language = person.language ? person.language : pnid.language;
	let timezoneName = person.tz_name ? person.tz_name : pnid.timezone.name;

	// * Fix for 3DS sending empty person.tz_name, which is interpreted as an empty object
	// TODO - See if there's a cleaner way to do this?

	if (typeof timezoneName === 'object' && Object.keys(timezoneName).length === 0) {
		timezoneName = pnid.timezone.name;
	}

	const marketingFlag = person.marketing_flag ? person.marketing_flag === 'Y' : pnid.flags.marketing;
	const offDeviceFlag = person.off_device_flag ? person.off_device_flag === 'Y' : pnid.flags.off_device;

	const regionLanguages = timezones[countryCode as keyof typeof timezones];
	const regionTimezones = regionLanguages[language as keyof typeof regionLanguages] ? regionLanguages[language as keyof typeof regionLanguages] : Object.values(regionLanguages)[0];
	let timezone = regionTimezones.find(tz => tz.area === timezoneName);

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

	if (person.password) {
		const primaryPasswordHash = nintendoPasswordHash(person.password, pnid.pid);
		const passwordHash = await bcrypt.hash(primaryPasswordHash, 10);

		pnid.password = passwordHash;

		await pnid.removeAllTokens();
	}

	pnid.gender = gender;
	pnid.region = region;
	pnid.country = countryCode;
	pnid.language = language;
	pnid.timezone.name = timezoneName;
	pnid.timezone.offset = Number(timezone.utc_offset);
	pnid.flags.marketing = marketingFlag;
	pnid.flags.off_device = offDeviceFlag;

	await pnid.save();

	response.send('');
});

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/people/@me/emails/
 * Description: Gets a list (why?) of PNID emails
 */
router.get('/@me/emails', async (request: express.Request, response: express.Response): Promise<void> => {
	const pnid = request.pnid;

	if (!pnid) {
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'access_token',
					code: '0002',
					message: 'Invalid access token'
				}
			}
		}).end());

		return;
	}

	response.send(xmlbuilder.create({
		emails: [
			{
				email: {
					address: pnid.email.address,
					id: pnid.email.id,
					parent: pnid.email.parent ? 'Y' : 'N',
					primary: pnid.email.primary ? 'Y' : 'N',
					reachable: pnid.email.reachable ? 'Y' : 'N',
					type: 'DEFAULT', // * what is this?
					updated_by: 'USER', // * need to actually update this
					validated: pnid.email.validated ? 'Y' : 'N',
					validated_date: pnid.email.validated_date
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
router.put('/@me/emails/@primary', async (request: express.Request, response: express.Response): Promise<void> => {
	const pnid = request.pnid;

	const email: {
		address: string;
	} = request.body.email;

	if (!pnid || !email || !email.address) {
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'access_token',
					code: '0002',
					message: 'Invalid access token'
				}
			}
		}).end());

		return;
	}

	// TODO - Better email check
	pnid.email.address = email.address.toLowerCase();
	pnid.email.reachable = false;
	pnid.email.validated = false;
	pnid.email.validated_date = '';
	pnid.email.id = crypto.randomBytes(4).readUInt32LE();

	await pnid.generateEmailValidationCode();
	await pnid.generateEmailValidationToken();

	await pnid.save();

	await sendConfirmationEmail(pnid);

	response.send('');
});

export default router;
