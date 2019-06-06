const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crytpo = require('../helpers/crypto');
const {mongoose: {uri, database_name, connection_options}} = require('../config');
const {PNID} = require('../models/pnid');

mongoose.connect(`${uri}/${database_name}`, connection_options);
const connection = mongoose.connection;
connection.on('error', console.error.bind(console, 'connection error:'));

let database;

class Database {
	constructor(connection) {
		this.connection = connection;
	}

	async getNEXServerAddress(gameServerID) {
		// EVENTUALLY WE NEED TO STORE THESE IN A DATABASE AND QUERY THEM. FOR NOW, HARD-CODED
		switch (gameServerID) {
			case '00003200':
				return ['192.168.0.20', 60000];
		}
	}

	async getUserByUsername(username) {
		if (typeof username !== 'string') {
			return null;
		}

		const user = await PNID.findOne({
			usernameLower: username.toLowerCase()
		});

		return user;
	}

	async getUserByPID(pid) {
		const user = await PNID.findOne({
			pid
		});

		return user;
	}

	async doesUserExist(username) {
		return !!await this.getUserByUsername(username);
	}

	async getUserBasic(token) {
		const [username, password] = Buffer.from(token, 'base64').toString().split(' ');
		const user = await this.getUserByUsername(username);
	
		if (!user) {
			return null;
		}
	
		const hashedPassword = crytpo.nintendoPasswordHash(password, user.pid);
	
		if (!bcrypt.compareSync(hashedPassword, user.password)) {
			return null;
		}
	
		return user;
	}

	async getUserBearer(token) {
		const user = await PNID.findOne({
			'validation.access_token.value': token
		});

		if (user) {
			const expireTime = user.get('validation.access_token.ttl');

			if (Math.floor(Date.now()/1000) > expireTime) {
				return null;
			}
		}
	
		return user;
	}

	async getUserProfileJSONByPID(pid) {
		const user = await this.getUserByPID(pid);
		const device = user.get('consoles')[0]; // Just grab the first device
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
				updated_by: 'USER', // Can also be INTERNAL WS, don't know the difference
				validated: user.get('email.validated') ? 'Y' : 'N',
				//validated_date: user.get('email.validated_date') // not used atm
			},
			mii: {
				status: 'COMPLETED',
				data: user.get('mii.data'),
				id: user.get('mii.id'),
				mii_hash: user.get('mii.hash'),
				mii_images: {
					mii_image: {
						cached_url: user.get('mii.image_url'),
						id: user.get('mii.image_id'),
						url: user.get('mii.image_url'),
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
}

function databaseMiddleware(request, response, next) {
	if (!database) {
		database = new Database(connection);
	}

	request.database = database;

	return next();
}

module.exports = databaseMiddleware;