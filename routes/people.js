const router = require('express').Router();
const json2xml = require('json2xml');
const Recaptcha = require('express-recaptcha').RecaptchaV2;
const crypto = require('crypto');
const util = require('../helpers/util');
const mailer = require('../helpers/mailer');
const nintendoClientHeaderCheck = require('../middleware/nintendoClientHeaderCheck');
const {PNID} = require('../models/pnid');
const {Console} = require('../models/console');
const {DeviceAttribute} = require('../models/deviceattribute');
const config = require('../config.json');
const recaptcha = new Recaptcha(config.recaptcha.siteKey, config.recaptcha.secretKey);

/**
 * [POST]
 * Description: Registers a user from the web panel. Has different error style since the console doesn't touch this endpoint
 */

router.post('/registerwp', recaptcha.middleware.verify, async (request, response) => {
	if (request.recaptcha.error) {
		response.status(400);
		return response.json({
			error: true,
			message: 'Failed to validate captcha'
		});
	}

	const {birthdate, gender, email, username, password, confirm_password} = request.body;
	
	if (!birthdate || !gender || !email || !username || !password || !confirm_password) {
		response.status(400);
		return response.json({
			error: true,
			message: 'Invalid post body'
		});
	}

	const user_exists = await request.database.doesUserExist(username);
	
	if (user_exists) {
		response.status(400);
		return response.json({
			error: true,
			message: 'Account ID already exists'
		});
	}

	if (password !== confirm_password) {
		response.status(400);
		return response.json({
			error: true,
			message: 'Passwords do not match'
		});
	}

	const date = new Date().toISOString();
	const miiHash = crypto.createHash('md5').update(date).digest('hex');

	const document = {
		creation_date: date.split('.')[0],
		updated: date,
		username,
		password,
		birthdate,
		gender,
		country: 'US', // hardcoded for now. currently testing
		language: 'en', // hardcoded for now. currently testing
		email: {
			address: email,
			primary: true, // hardcoded for now. currently testing
			parent: true, // hardcoded for now. currently testing
			reachable: true, // hardcoded for now. currently testing
			validated: false, // Will be updated once validated
			id: util.generateRandomInt(10)
		},
		region: 0x310B0000, // hardcoded for now. currently testing
		timezone: { // hardcoded for now. currently testing
			name: 'America/New_York',
			offset: -14400
		},
		mii: {
			name: `${username} mii`,
			primary: true,
			data: 'AwAAQIhluwTgxEAA2NlGWQOzuI0n2QAAAEBsAG8AZwBpAG4AdABlAHMAdAAAAEBAAAAhAQJoRBgmNEYUgRIXaA0AACkAUkhQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMw7', // hardcoded for now. currently testing
			id: util.generateRandomInt(10),
			hash: miiHash,
			image_url: 'https://mii-secure.account.nintendo.net/2rtgf01lztoqo_standard.tga',
			image_id: util.generateRandomInt(10)
		},
		flags: {
			active: true,
			marketing: false,
			off_device: true
		},
		validation: {
			// These values are temp and will be overwritten before the document saves
			// These values are only being defined to get around the `E11000 duplicate key error collection` error
			email_code: Date.now(),
			email_token: Date.now().toString()
		}
	};

	const newUser = new PNID(document);

	newUser.save(async (error, newUser) => {
		if (error) {
			return console.log(error);
		}

		mailer.send(
			newUser.get('email.address'),
			'[Pretendo Network] Please confirm your e-mail address',
			`Hello ${newUser.get('username')},
			Your Pretendo Network ID activation is almost complete. Please click the link below to confirm your e-mail address and complete the activation process.
			
			https://account.pretendo.cc/account/email-confirmation?token=${newUser.get('validation.email_token')}
			
			If you are unable to connect to the above URL, please enter the following confirmation code on the device to which your Pretendo Network ID is linked.
			
			&lt;&lt;Confirmation code: ${newUser.get('validation.email_code')}&gt;&gt;`
		);

		return response.send(json2xml({
			person: {
				pid: newUser.get('pid')
			}
		}));
	});
});

/**
 * [POST]
 * Replacement for: https://account.nintendo.net/v1/api/people/
 * Description: Registers a user from a console. Unused at the moment
 */

router.post('/', (request, response) => {
	request.errors.push({
		error: {
			cause: 'Bad Request',
			code: '1600',
			message: 'Unable to process request'
		}
	});
	
	request.checkForErrors(() => {
		response.status(200);
		response.end();
	});
});

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/people/:username
 * Description: Checks if username already in use
 */
router.get('/:username', nintendoClientHeaderCheck, async (request, response) => {
	const username = request.params.username;

	const user_exists = await request.database.doesUserExist(username);
	
	if (user_exists) {
		request.errors.push({
			error: {
				code: '0100',
				message: 'Account ID already exists'
			}
		});
	}

	request.checkForErrors(() => {
		response.status(200);
		response.end();
	});
});

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/people/@me/profile
 * Description: Gets a users profile
 */
router.get('/@me/profile', nintendoClientHeaderCheck, async (request, response) => {
	const person = await request.database.getUserProfileJSONByPID(request.pnid.get('pid'));

	response.send(json2xml({person}));
});

/**
 * [PUT]
 * Replacement for: https://account.nintendo.net/v1/api/people/@me/miis/@primary
 * Description: Updates a users Mii
 */
router.put('/@me/miis/@primary', nintendoClientHeaderCheck, async (request, response) => {
	await request.pnid.updateMii(request.body.mii);

	response.send('');
});

/**
 * [POST]
 * Replacement for: https://account.nintendo.net/v1/api/people/@me/devices
 * Description: Updates profile device attributes
 */
router.post('/@me/devices', nintendoClientHeaderCheck, async (request, response) => {
	const {headers} = request;

	const postDeviceAttributes = request.body.device_attributes;
	const device_attributes = [];

	const date = new Date().toISOString();
	
	for (const {name, value, created_date} of postDeviceAttributes.device_attribute) {
		const deviceAttributeDocument = {
			name,
			value
		};

		if (created_date) {
			deviceAttributeDocument.created_date = created_date;
		} else {
			deviceAttributeDocument.created_date = date.split('.')[0];
		}

		device_attributes.push(new DeviceAttribute(deviceAttributeDocument));
	}
	
	const _console = new Console({
		type: 'wup', // Find a way to dynamically figure out the type
		device_id: headers['x-nintendo-device-id'],
		device_type: headers['x-nintendo-device-type'],
		serial: headers['x-nintendo-serial-number'],
		device_attributes
	});

	await request.pnid.addConsole(_console);

	const person = await request.database.getUserProfileJSONByPID(request.pnid.get('pid'));

	response.send(json2xml({person}));
});

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/people/@me/devices/owner
 * Description: Gets user profile data
 */
router.get('/@me/devices/owner', nintendoClientHeaderCheck, async (request, response) => {
	// Lots of this is hard-coded for now until we add these values to the accounts
	const person = {
		person: {
			active_flag: request.pnid.get('flags.active') ? 'Y' : 'N',
			birth_date: request.pnid.get('birthdate'),
			country: request.pnid.get('country'),
			create_date: request.pnid.get('creation_date'),
			gender: request.pnid.get('gender'),
			language: request.pnid.get('language'),
			updated: request.pnid.get('updated'),
			marketing_flag: request.pnid.get('flags.marketing') ? 'Y' : 'N',
			off_device_flag: request.pnid.get('flags.off_device') ? 'Y' : 'N',
			pid: request.pnid.pid,
			email: {
				address: request.pnid.get('email.address'),
				id: request.pnid.get('email.id'),
				parent: request.pnid.get('email.parent') ? 'Y' : 'N',
				primary: request.pnid.get('email.primary') ? 'Y' : 'N',
				reachable: request.pnid.get('email.reachable') ? 'Y' : 'N',
				type: 'DEFAULT',
				updated_by: 'USER',
				validated: request.pnid.get('email.validated') ? 'Y' : 'N'
			},
			/*mii: { // Actually not needed, the console seems fine without it
				status: 'COMPLETED',
				data: request.pnid.get('mii.data'),
				id: request.pnid.get('mii.id'),
				mii_hash: request.pnid.get('mii.hash'),
				mii_images: {
					mii_image: {
						cached_url: request.pnid.get('mii.image_url'),
						id: request.pnid.get('mii.image_id'),
						url: request.pnid.get('mii.image_url'),
						type: 'standard'
					}
				},
				name: request.pnid.get('mii.name'),
				primary: request.pnid.get('mii.primary') ? 'Y' : 'N',
			},*/
			region: request.pnid.get('region'),
			tz_name: request.pnid.get('timezone.name'),
			user_id: request.pnid.get('username'),
			utc_offset: request.pnid.get('timezone.offset')
		}
	};

	response.send(json2xml(person));
});

module.exports = router;