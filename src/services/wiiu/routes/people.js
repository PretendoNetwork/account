const router = require('express').Router();
const xmlbuilder = require('xmlbuilder');
const moment = require('moment');
const crypto = require('crypto');
const { PNID } = require('../../../models/pnid');
const { NEXAccount } = require('../../../models/nex-account');
const clientHeaderCheck = require('../../../middleware/client-header');
const deviceCertificateMiddleware = require('../../../middleware/device-certificate');
const ratelimit = require('../../../middleware/ratelimit');
const database = require('../../../database');
const mailer = require('../../../mailer');
require('moment-timezone');

router.get('/:username', clientHeaderCheck, async (request, response) => {
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

router.post('/', clientHeaderCheck, ratelimit, deviceCertificateMiddleware, async (request, response) => {
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

	const document = {
		pid: 1, // will be overwritten before saving
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

	const newNEXAccount = new NEXAccount({
		owning_pid: newPNID.get('pid'),
	});
	await newNEXAccount.save();

	await mailer.send(
		newPNID.get('email'),
		'[Prentendo Network] Please confirm your e-mail address',
		`Hello,
		
		Your Prentendo Network ID activation is almost complete.  Please click the link below to confirm your e-mail address and complete the activation process.
		
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
router.get('/@me/profile', clientHeaderCheck, async (request, response) => {
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
router.post('/@me/devices', clientHeaderCheck, async (request, response) => {
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
router.get('/@me/devices', clientHeaderCheck, async (request, response) => {
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
router.get('/@me/devices/owner', clientHeaderCheck, async (request, response) => {
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
 * [PUT]
 * Replacement for: https://account.nintendo.net/v1/api/people/@me/miis/@primary
 * Description: Updates a users Mii
 */
router.put('/@me/miis/@primary', clientHeaderCheck, async (request, response) => {
	const { pnid } = request;

	const mii = request.body.get('mii');

	const [name, primary, data] = [mii.get('name'), mii.get('primary'), mii.get('data')];

	await pnid.updateMii({name, primary, data});

	response.send('');
});

module.exports = router;