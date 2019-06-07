const argv = require('yargs').argv;
const assert = require('assert');
const mongoose = require('mongoose');
const crypto = require('crypto');
const util = require('./helpers/util');
const {mongoose: {uri, database_name, connection_options}} = require('./config');
const {PNID} = require('./models/pnid');
const {username, email, password} = argv;

assert(username, 'Provide --username flag');
assert(email, 'Provide --email flag');
assert(password, 'Provide --password flag');

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

mongoose.connect(`${uri}/${database_name}`, connection_options);
const connection = mongoose.connection;

connection.once('open', async () => {
	const newUser = new PNID(document);

	newUser.save(async (error, newUser) => {
		console.log(newUser);
	});
});