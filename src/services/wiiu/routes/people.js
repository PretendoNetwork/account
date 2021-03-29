const router = require('express').Router();
const xmlbuilder = require('xmlbuilder');
const moment = require('moment');
const crypto = require('crypto');
const { PNID } = require('../../../models/pnid');
const clientHeaderCheck = require('../../../middleware/client-header');
const database = require('../../../database');
const mailer = require('../../../mailer');
require('moment-timezone');

router.get('/:username', clientHeaderCheck, async (request, response) => {
	// Status should be 1 from previous request in registration process
	if (request.session.registration_status !== 1) {
		response.status(400);

		return response.send(xmlbuilder.create({
			error: {
				cause: 'Bad Request',
				code: '1600',
				message: 'Unable to process request'
			}
		}).end());
	}

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

	// Bump status to allow access to next endpoint
	request.session.registration_status = 2;

	response.status(200);
	response.end();
});

router.post('/', clientHeaderCheck, async (request, response) => {
	// Status should be 3 from previous request in registration process
	if (request.session.registration_status !== 3) {
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
			id: Math.floor(Math.random(10000000000)*10000000000)
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
			id: Math.floor(Math.random(10000000000)*10000000000),
			hash: crypto.createHash('md5').update(person.get('mii').get('data')).digest('hex'),
			image_url: 'https://mii-secure.account.nintendo.net/2rtgf01lztoqo_standard.tga',
			image_id: Math.floor(Math.random(10000000000)*10000000000)
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

	const newUser = new PNID(document);

	newUser.save()
		.catch(error => {
			console.log(error);

			response.status(400);

			return response.send(xmlbuilder.create({
				error: {
					cause: 'Bad Request',
					code: '1600',
					message: 'Unable to process request'
				}
			}).end());
		})
		.then(async newUser => {
			await mailer.send(
				newUser.get('email'),
				'[Prentendo Network] Please confirm your e-mail address',
				`Hello,
		
				Your Prentendo Network ID activation is almost complete.  Please click the link below to confirm your e-mail address and complete the activation process.
				
				https://account.pretendo.cc/account/email-confirmation?token=` + newUser.get('identification.email_token') + `
				
				If you are unable to connect to the above URL, please enter the following confirmation code on the device to which your Prentendo Network ID is linked.
				
				&lt;&lt;Confirmation code: ` + newUser.get('identification.email_code') + '&gt;&gt;'
			);
			
			delete request.session.registration_status;
	
			response.send(xmlbuilder.create({
				person: {
					pid: newUser.get('pid')
				}
			}).end());
		});
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
	}).end());
	

	//response.send(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><person><accounts><account><attributes><attribute><id>84955611</id><name>ctr_initial_device_account_id</name><updated_by>USER</updated_by><value>195833643</value></attribute><attribute><id>84955489</id><name>environment</name><updated_by>USER</updated_by><value>PROD</value></attribute></attributes><domain>ESHOP.NINTENDO.NET</domain><type>INTERNAL</type><username>327329101</username></account></accounts><active_flag>Y</active_flag><birth_date>1998-09-22</birth_date><country>US</country><create_date>2017-12-29T04:11:24</create_date><device_attributes><device_attribute><created_date>2019-11-24T15:26:06</created_date><name>persistent_id</name><value>80000043</value></device_attribute><device_attribute><created_date>2019-11-24T15:26:06</created_date><name>transferable_id_base</name><value>1200000444b6221d</value></device_attribute><device_attribute><created_date>2019-11-24T15:26:06</created_date><name>transferable_id_base_common</name><value>1180000444b6221d</value></device_attribute><device_attribute><created_date>2019-11-24T15:26:06</created_date><name>uuid_account</name><value>42ef6c46-0ea3-11ea-97fe-010144b6221d</value></device_attribute><device_attribute><created_date>2019-11-24T15:26:06</created_date><name>uuid_common</name><value>3d9b06d8-0ea3-11ea-97fe-010144b6221d</value></device_attribute></device_attributes><gender>M</gender><language>en</language><updated>2019-06-02T04:17:56</updated><marketing_flag>Y</marketing_flag><off_device_flag>Y</off_device_flag><pid>1750087940</pid><email><address>halolink44@gmail.com</address><id>50463196</id><parent>N</parent><primary>Y</primary><reachable>Y</reachable><type>DEFAULT</type><updated_by>INTERNAL WS</updated_by><validated>Y</validated><validated_date>2017-12-29T04:12:32</validated_date></email><mii><status>COMPLETED</status><data>AwBzMOlVognnx0GCk6r2p0D0B2n+cgAA0lJSAGUAZABEAHUAYwBrAHMAAAAAAGQrAAAWAQJoRBgmNEYUgRIXaI0AiiWBSUhQUgBlAGQARAB1AGMAawBzAHMAAAAAAJZY</data><id>1151699634</id><mii_hash>u2jg043u028x</mii_hash><mii_images><mii_image><cached_url>https://mii-secure.account.nintendo.net/u2jg043u028x_standard.tga</cached_url><id>1319591505</id><url>https://mii-secure.account.nintendo.net/u2jg043u028x_standard.tga</url><type>standard</type></mii_image></mii_images><name>RedDucks</name><primary>Y</primary></mii><region>822870016</region><tz_name>America/New_York</tz_name><user_id>RedDuckss</user_id><utc_offset>-18000</utc_offset></person>`);

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

	const [name, primary, data] = [mii.get('name'), mii.get('primary'), mii.get('data')]

	await pnid.updateMii({name, primary, data});

	response.send('');
});

module.exports = router;