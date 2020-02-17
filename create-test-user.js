const prompt = require('prompt');
const crypto = require('crypto');
const util = require('./src/util');
const database = require('./src/database');
const { PNID } = require('./src/models/pnid');

prompt.message = '';

const properties = [
	'username',
	'email',
	{
		name: 'password',
		hidden: true
	}
];

prompt.get(properties, function (error, { username, email, password }) {
	const date = new Date().toISOString();
	const miiHash = crypto.createHash('md5').update(date).digest('hex');
	
	const document = {
		pid: 1,
		creation_date: date.split('.')[0],
		updated: date,
		username: username,
		password: password,
		birthdate: '1990-01-01',
		gender: 'M',
		country: 'US',
		language: 'en',
		email: {
			address: email,
			primary: true,
			parent: true,
			reachable: true,
			validated: true,
			id: util.generateRandomInt(10)
		},
		region: 0x310B0000,
		timezone: {
			name: 'America/New_York',
			offset: -14400
		},
		mii: {
			name: 'UserMii',
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
			throw error;
		}
		
		console.log(newUser);
		console.log('New user created');
	});
});

database.connect().then(prompt.start);