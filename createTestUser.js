const argv = require('yargs').argv;
const assert = require('assert');
const mongoose = require('mongoose');
const {mongoose: {uri, database_name, connection_options}} = require('./config');
const {PNID} = require('./models/pnid');
const {username, email, password} = argv;

assert(username, 'Provide --username flag');
assert(email, 'Provide --email flag');
assert(password, 'Provide --password flag');

const date = new Date().toISOString();

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
		validated: true
	},
	region: 0x310B0000,
	timezone: {
		name: 'America/New_Tork',
		offset: -14400
	},
	mii: {
		name: 'logintest',
		primary: true,
		data: `AwAAQIhluwTgxEAA2NlGWQOzuI0n2QAAAEBsAG8AZwBpAG4AdABlAHMAdAAAAEBAAAAhAQJoRBgm
		NEYUgRIXaA0AACkAUkhQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMw7`,
		hash: 'hash',
		url: 'url'
	},
	flags: { // not entirely sure what these are used for
		active: true, // Is the account active? Like, not deleted maybe?
		marketing: false, // Send email ads?
		off_device: true // No idea
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