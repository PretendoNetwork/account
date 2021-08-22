const prompt = require('prompt');
const crypto = require('crypto');
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

prompt.get(properties, (error, { username, email, password }) => {
	const date = new Date().toISOString();
	// Sample Mii data
	const miiData = 'AwAAQOlVognnx0GC2X0LLQOzuI0n2QAAAUBiAGUAbABsAGEAAABFAAAAAAAAAEBAEgCBAQRoQxggNEYUgRIXaA0AACkDUkhQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP6G';
	
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
			id: crypto.randomBytes(4).readUInt32LE()
		},
		region: 0x310B0000,
		timezone: {
			name: 'America/New_York',
			offset: -14400
		},
		mii: {
			name: 'bella',
			primary: true,
			data: miiData,
			id: crypto.randomBytes(4).readUInt32LE(),
			hash: crypto.randomBytes(7).toString('hex'),
			image_url: '', // Deprecated, will be removed
			image_id: crypto.randomBytes(4).readUInt32LE()
		},
		flags: {
			active: true,
			marketing: false,
			off_device: true
		},
		validation: {
			// These values are temp and will be overwritten before the document saves
			// These values are only being defined to get around the `E11000 duplicate key error collection` error
			email_code: 1,
			email_token: ''
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