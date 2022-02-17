const router = require('express').Router();
const xmlbuilder = require('xmlbuilder');
const moment = require('moment');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { PNID } = require('../../../models/pnid');
const { NEXAccount } = require('../../../models/nex-account');
const deviceCertificateMiddleware = require('../../../middleware/device-certificate');
const ratelimit = require('../../../middleware/ratelimit');
const database = require('../../../database');
const mailer = require('../../../mailer');
require('moment-timezone');

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

	// Create new NEX account
	const newNEXAccount = new NEXAccount({
		pid: 0,
		password: '',
		owning_pid: 0,
	});
	await newNEXAccount.save();

	const creationDate = moment().format('YYYY-MM-DDTHH:MM:SS');

	const document = {
		pid: newNEXAccount.get('pid'),
		creation_date: creationDate,
		updated: creationDate,
		username: person.get('user_id'),
		password: person.get('password'), // will be hashed before saving
		birthdate: person.get('birth_date'),
		gender: person.get('gender'),
		country: person.get('country'),
		language: person.get('language'),
		email: {
			address: person.get('email').get('address'),
			primary: person.get('email').get('primary') === 'Y',
			parent: person.get('email').get('parent') === 'Y',
			reachable: false,
			validated: person.get('email').get('validated') === 'Y',
			id: crypto.randomBytes(4).readUInt32LE()
		},
		region: person.get('region'),
		timezone: {
			name: person.get('tz_name'),
			offset: (moment.tz(person.get('tz_name')).utcOffset() * 60)
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
		validation: {
			email_code: 1, // will be overwritten before saving
			email_token: '' // will be overwritten before saving
		}
	};

	const newPNID = new PNID(document);
	await newPNID.save();

	// Quick hack to get the PIDs to match
	// TODO: Change this
	// NN with a NNID will always use the NNID PID
	// even if the provided NEX PID is different
	// To fix this we make them the same PID
	await NEXAccount.updateOne({
		pid: newNEXAccount.get('pid')
	}, {
		owning_pid: newNEXAccount.get('pid')
	});

	await mailer.send(
		newPNID.get('email'),
		'[Pretendo Network] Please confirm your e-mail address',
		`Hello,
		
		Your Pretendo Network ID activation is almost complete.  Please click the link below to confirm your e-mail address and complete the activation process.
		
		https://account.pretendo.cc/account/email-confirmation?token=` + newPNID.get('identification.email_token') + `
		
		If you are unable to connect to the above URL, please enter the following confirmation code on the device to which your Prentendo Network ID is linked.
		
		&lt;&lt;Confirmation code: ` + newPNID.get('identification.email_code') + '&gt;&gt;'
	);

	response.send(xmlbuilder.create({
		person: {
			pid: newPNID.get('pid')
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
	response.set('X-Nintendo-Date', new Date().getTime());
	
	
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
	response.set('X-Nintendo-Date', new Date().getTime());

	// We don't care about the device attributes
	// The console ignores them and PNIDs are not tied to consoles anyway
	// So the server also ignores them and does not save the ones posted here

	const { pnid } = request;

	const person = await database.getUserProfileJSONByPID(pnid.get('pid'));

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
	response.set('X-Nintendo-Date', new Date().getTime());
	
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
	response.set('X-Nintendo-Date', moment().add(5, 'h'));

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
	response.set('X-Nintendo-Date', moment().add(5, 'h'));

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
	response.set('X-Nintendo-Date', new Date().getTime());

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

	await PNID.deleteOne({ pid: pnid.get('pid') });

	response.send('');
});

/**
 * [PUT]
 * Replacement for: https://account.nintendo.net/v1/api/people/@me/
 * Description: Updates a PNIDs account details
 */
router.put('/@me', async (request, response) => {
	const { pnid } = request;
	const { person } = request.body;

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

	const gender = person.gender ? person.gender : pnid.get('gender');
	const region = person.region ? person.region : pnid.get('region');
	const timezoneName = person.tz_name ? person.tz_name : pnid.get('timezone.name');
	const marketingFlag = person.marketing_flag ? person.marketing_flag === 'Y' : pnid.get('flags.marketing');
	const offDeviceFlag = person.off_device_flag ? person.off_device_flag === 'Y' : pnid.get('flags.off_device');

	if (person.password) {
		const primaryHash = util.nintendoPasswordHash(person.password, pnid.get('pid'));
		const hashedPassword = bcrypt.hashSync(primaryHash, 10);

		pnid.password = hashedPassword;
	}

	pnid.gender = gender;
	pnid.region = region;
	pnid.timezone.name = timezoneName;
	pnid.timezone.offset = (moment.tz(timezoneName).utcOffset() * 60);
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
	const { email } = request.body;

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

	pnid.email.address = email.address;
	pnid.email.reachable = false;
	pnid.email.validated = false;
	pnid.email.id = crypto.randomBytes(4).readUInt32LE();

	// TODO: Change these, they are slow
	await pnid.generateEmailValidationCode();
	await pnid.generateEmailValidationToken();

	await pnid.save();

	await mailer.send(
		email.address,
		'[Pretendo Network] Please confirm your e-mail address',
		`Hello,
		
		Your Pretendo Network ID activation is almost complete.  Please click the link below to confirm your e-mail address and complete the activation process.
		
		https://account.pretendo.cc/account/email-confirmation?token=` + pnid.get('identification.email_token') + `
		
		If you are unable to connect to the above URL, please enter the following confirmation code on the device to which your Prentendo Network ID is linked.
		
		&lt;&lt;Confirmation code: ` + pnid.get('identification.email_code') + '&gt;&gt;'
	);

	response.send('');
});

module.exports = router;