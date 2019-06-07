const {Schema, model} = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator');
const randtoken = require('rand-token');
const bcrypt = require('bcrypt');
const crypto = require('../helpers/crypto');
const {ConsoleSchema} = require('./console');

const PNIDSchema = new Schema({
	access_level: {
		type: Number,
		default: 0 // Standard user
	},
	pid: {
		type: Number,
		unique: true
	},
	creation_date: String,
	updated: String,
	username: {
		type: String,
		unique: true,
		minlength: 6,
		maxlength: 16
	},
	usernameLower: {
		type: String,
		unique: true
	},
	password: String,
	birthdate: String,
	gender: String,
	country: String,
	language: String,
	email: {
		address: String,
		primary: Boolean,
		parent: Boolean,
		reachable: Boolean,
		validated: Boolean,
		validated_date: String,
		id: {
			type: Number,
			unique: true
		}
	},
	region: Number,
	timezone: {
		name: String,
		offset: Number
	},
	mii: {
		name: String,
		primary: Boolean,
		data: String,
		id: {
			type: Number,
			unique: true
		},
		hash: {
			type: String,
			unique: true
		},
		image_url: String,
		image_id: {
			type: Number,
			unique: true
		},
	},
	flags: { // not entirely sure what these are used for
		active: Boolean, // Is the account active? Like, not deleted maybe?
		marketing: Boolean,
		off_device: Boolean
	},
	consoles: [ConsoleSchema],
	nex: {
		password: String,
		token: String
	},
	validation: { // user identification tokens
		email_code: {
			type: String,
			unique: true
		},
		email_token: {
			type: String,
			unique: true
		},
		access_token: {
			value: String,
			ttl: Number
		},
		refresh_token: {
			value: String,
			ttl: Number
		},
		service_token: {
			value: String,
			ttl: Number
		}
	}
});

PNIDSchema.plugin(uniqueValidator, {message: '{PATH} already in use.'});

/*
	According to http://pf2m.com/tools/rank.php Nintendo PID's start at 1,800,000,000 and count down with each account
	This means the max PID is 1799999999 and hard-limits the number of potential accounts to 1,800,000,000
	The author of that site does not give any information on how they found this out, but it does seem to hold true
	https://account.nintendo.net/v1/api/admin/mapped_ids?input_type=pid&output_type=user_id&input=1800000000 returns nothing
	https://account.nintendo.net/v1/api/admin/mapped_ids?input_type=pid&output_type=user_id&input=1799999999 returns `prodtest1`
	and the next few accounts counting down seem to be admin, service and internal test accounts
*/
PNIDSchema.methods.generatePID = async function() {
	const min = 1000000000; // The console (WiiU) seems to not accept PIDs smaller than this
	const max = 1799999999;

	let pid =  Math.floor(Math.random() * (max - min + 1) + min);

	const inuse = await PNID.findOne({
		pid
	});

	pid = (inuse ? await PNID.generatePID() : pid);

	this.set('pid', pid);
};

PNIDSchema.methods.generateNEXPassword = function() {
	const output = [];
	const character = () => {
		const offset = Math.floor(Math.random() * 62);
		if (offset < 10) return offset;
		if (offset < 36) return String.fromCharCode(offset + 55);
		return String.fromCharCode(offset + 61);
	};

	while (output.length < 16) {
		output.push(character());
	}

	this.set('nex.password', output.join(''));
};

PNIDSchema.methods.generateEmailValidationCode = async function() {
	let code = Math.random().toFixed(6).split('.')[1]; // Dirty one-liner to generate numbers of 6 length and padded 0
	const inuse = await PNID.findOne({
		'validation.email_code': code
	});
		
	code = (inuse ? await PNID.generateEmailValidationCode() : code);

	this.set('validation.email_code', code);
};

PNIDSchema.methods.generateEmailValidationToken = async function() {
	let token = randtoken.generate(32);
	const inuse = await PNID.findOne({
		'validation.email_token': token
	});

	token = (inuse ? await PNID.generateEmailValidationToken() : token);

	this.set('validation.email_token', token);
};

PNIDSchema.methods.generateAccessTokens = async function() {
	const expireTime = Math.floor((Date.now() / 1000) + 3600); // Only valid for an hour
	let accessToken = crypto.generateAccessToken(this.get('pid'));
	let refreshToken = crypto.generateRefreshToken(this.get('pid'));

	const accessTokenInuse = await PNID.findOne({
		'validation.access_token.value': accessToken
	});

	accessToken = (accessTokenInuse ? crypto.generateRefreshToken(this.get('pid')) : accessToken);

	const refreshTokenInuse = await PNID.findOne({
		'validation.refresh_token.value': refreshToken
	});

	refreshToken = (refreshTokenInuse ? crypto.generateRefreshToken(this.get('pid')) : refreshToken);

	this.set('validation.access_token.value', accessToken);
	this.set('validation.refresh_token.value', refreshToken);
	this.set('validation.access_token.ttl', expireTime);
	this.set('validation.refresh_token.ttl', expireTime);

	await this.save();

	return [accessToken, refreshToken];
};

PNIDSchema.methods.getConsole = async function(document) {
	const consoles = this.get('consoles');

	return consoles.find(_console => {
		return (_console.device_id === document.device_id && _console.device_type === document.device_type && _console.serial === document.serial);
	});
};

PNIDSchema.methods.addConsole = async function(_console) {
	this.consoles.push(_console);

	await this.save();
};

PNIDSchema.methods.removeConsole = async function(_console) {
	this.consoles = this.consoles.filter(({_id}) => {
		return _id !== _console._id
	});

	await this.save();
};

PNIDSchema.methods.updateMii = async function({name, primary, data}) {
	this.set('mii.name', name);
	this.set('mii.primary', primary === 'Y');
	this.set('mii.data', data);

	await this.save();
};

PNIDSchema.pre('save', async function(next) {
	if (!this.isModified('password')) {
		return next();
	}

	this.set('usernameLower', this.get('username').toLowerCase());
	await this.generatePID();
	await this.generateNEXPassword();
	await this.generateEmailValidationCode();
	await this.generateEmailValidationToken();
	
	const primaryHash = crypto.nintendoPasswordHash(this.get('password'), this.get('pid'));
	const hash = bcrypt.hashSync(primaryHash, 10);

	this.set('password', hash);
	next();
});

const PNID = model('PNID', PNIDSchema);

module.exports = {
	PNIDSchema,
	PNID
};