const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const util = require('./util');
const { PNID } = require('./models/pnid');
const { mongoose: mongooseConfig } = require('./config.json');
const { uri, database, options } = mongooseConfig;

let connection;

async function connect() {
	await mongoose.connect(`${uri}/${database}`, options);
	
	connection = mongoose.connection;
	connection.on('error', console.error.bind(console, 'connection error:'));
}

function verifyConnected() {
	if (!connection) {
		throw new Error('Cannot make database requets without being connected');
	}
}

async function getUserByUsername(username) {
	verifyConnected();

	if (typeof username !== 'string') {
		return null;
	}

	const user = await PNID.findOne({
		usernameLower: username.toLowerCase()
	});

	return user;
}

async function getUserByPID(pid) {
	verifyConnected();

	const user = await PNID.findOne({
		pid
	});

	return user;
}

async function doesUserExist(username) {
	verifyConnected();

	return !!await this.getUserByUsername(username);
}

async function getUserBasic(token) {
	verifyConnected();

	const [username, password] = Buffer.from(token, 'base64').toString().split(' ');
	const user = await this.getUserByUsername(username);

	if (!user) {
		return null;
	}

	const hashedPassword = util.nintendoPasswordHash(password, user.pid);

	if (!bcrypt.compareSync(hashedPassword, user.password)) {
		return null;
	}

	return user;
}

async function getUserBearer(token) {
	verifyConnected();

	const decryptedToken = util.decryptToken(Buffer.from(token, 'base64'));
	const unpackedToken = util.unpackToken(decryptedToken);

	const user = await getUserByPID(unpackedToken.pid);

	if (user) {
		const expireTime = Math.floor((Number(unpackedToken.date) / 1000) + 3600);

		if (Math.floor(Date.now()/1000) > expireTime) {
			return null;
		}
	}

	return user;
}

async function getUserProfileJSONByPID(pid) {
	verifyConnected();

	const user = await this.getUserByPID(pid);
	const device = user.get('devices')[0]; // Just grab the first device
	let device_attributes;

	if (device) {
		device_attributes = device.get('device_attributes').map(({name, value, created_date}) => {
			const deviceAttributeDocument = {
				name,
				value
			};
	
			if (created_date) {
				deviceAttributeDocument.created_date = created_date;
			}

			return {
				device_attribute: deviceAttributeDocument
			};
		});
	}

	return {
		//accounts: {}, We need to figure this out, no idea what these values mean or what they do
		active_flag: user.get('flags.active') ? 'Y' : 'N',
		birth_date: user.get('birthdate'),
		country: user.get('country'),
		create_date: user.get('creation_date'),
		device_attributes: device_attributes,
		gender: user.get('gender'),
		language: user.get('language'),
		updated: user.get('updated'),
		marketing_flag: user.get('flags.marketing') ? 'Y' : 'N',
		off_device_flag: user.get('flags.off_device') ? 'Y' : 'N',
		pid: user.get('pid'),
		email: {
			address: user.get('email.address'),
			id: user.get('email.id'),
			parent: user.get('email.parent') ? 'Y' : 'N',
			primary: user.get('email.primary') ? 'Y' : 'N',
			reachable: user.get('email.reachable') ? 'Y' : 'N',
			type: 'DEFAULT',
			updated_by: 'INTERNAL WS', // Can also be INTERNAL WS, don't know the difference
			validated: user.get('email.validated') ? 'Y' : 'N',
			//validated_date: user.get('email.validated_date') // not used atm
		},
		mii: {
			status: 'COMPLETED',
			data: user.get('mii.data').replace(/(\r\n|\n|\r)/gm, ''),
			id: user.get('mii.id'),
			mii_hash: user.get('mii.hash'),
			mii_images: {
				mii_image: {
					// Images MUST be loaded over HTTPS or console ignores them
					// Bunny CDN is the only CDN which seems to support TLS 1.0/1.1 (required)
					cached_url: `https://pretendo-cdn.b-cdn.net/mii/${user.pid}/standard.tga`,
					id: user.get('mii.image_id'),
					url: `https://pretendo-cdn.b-cdn.net/mii/${user.pid}/standard.tga`,
					type: 'standard'
				}
			},
			name: user.get('mii.name'),
			primary: user.get('mii.primary') ? 'Y' : 'N',
		},
		region: user.get('region'),
		tz_name: user.get('timezone.name'),
		user_id: user.get('username'),
		utc_offset: user.get('timezone.offset')
	};
}

module.exports = {
	connect,
	getUserByUsername,
	getUserByPID,
	doesUserExist,
	getUserBasic,
	getUserBearer,
	getUserProfileJSONByPID,
};