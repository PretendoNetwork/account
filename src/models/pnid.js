const { Schema, model } = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const imagePixels = require('image-pixels');
const TGA = require('tga');
const got = require('got');
const util = require('../util');
const { DeviceSchema } = require('./device');
const Mii = require('../mii');

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
	devices: [DeviceSchema],
	nex: {
		password: String,
		token: String
	},
	identification: { // user identification tokens
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
	function character() {
		const offset = Math.floor(Math.random() * 62);
		if (offset < 10) return offset;
		if (offset < 36) return String.fromCharCode(offset + 55);
		return String.fromCharCode(offset + 61);
	}

	const output = [];

	while (output.length < 16) {
		output.push(character());
	}

	this.set('nex.password', output.join(''));
};

PNIDSchema.methods.generateEmailValidationCode = async function() {
	let code = Math.random().toFixed(6).split('.')[1]; // Dirty one-liner to generate numbers of 6 length and padded 0

	const inuse = await PNID.findOne({
		'identification.email_code': code
	});
		
	code = (inuse ? await PNID.generateEmailValidationCode() : code);

	this.set('identification.email_code', code);
};

PNIDSchema.methods.generateEmailValidationToken = async function() {
	let token = crypto.randomBytes(32).toString('hex');

	const inuse = await PNID.findOne({
		'identification.email_token': token
	});

	token = (inuse ? await PNID.generateEmailValidationToken() : token);

	this.set('identification.email_token', token);
};

PNIDSchema.methods.getDevice = async function(document) {
	const devices = this.get('devices');

	return devices.find(device => {
		return (
			(device.device_id === document.device_id) &&
			(device.device_type === document.device_type) &&
			(device.serial === document.serial)
		);
	});
};

PNIDSchema.methods.addDevice = async function(device) {
	this.devices.push(device);

	await this.save();
};

PNIDSchema.methods.removeDevice = async function(device) {
	this.devices = this.devices.filter(({ _id }) =>  _id !== device._id);

	await this.save();
};

PNIDSchema.methods.updateMii = async function({name, primary, data}) {
	this.set('mii.name', name);
	this.set('mii.primary', primary === 'Y');
	this.set('mii.data', data);
	this.set('mii.hash', crypto.randomBytes(7).toString('hex'));
	this.set('mii.id', crypto.randomBytes(4).readUInt32LE());
	this.set('mii.image_id', crypto.randomBytes(4).readUInt32LE());

	await this.generateMiiImages();

	await this.save();
};

PNIDSchema.methods.generateMiiImages = async function() {
	const miiData = this.get('mii.data');
	const studioMii = new Mii(Buffer.from(miiData, 'base64'));
	const converted = studioMii.toStudioMii();
	const encodedStudioMiiData = converted.toString('hex');
	const miiStudioUrl = `https://studio.mii.nintendo.com/miis/image.png?data=${encodedStudioMiiData}&type=face&width=128&instanceCount=1`;
	const miiStudioNormalFaceImageData = await got(miiStudioUrl).buffer();
	const pngData = await imagePixels(miiStudioNormalFaceImageData);
	const tga = TGA.createTgaBuffer(pngData.width, pngData.height, pngData.data);

	const userMiiKey = `mii/${this.get('pid')}`;

	await util.uploadCDNAsset(`${userMiiKey}/standard.tga`, tga);
	await util.uploadCDNAsset(`${userMiiKey}/normal_face.png`, miiStudioNormalFaceImageData);

	const expressions = ['frustrated', 'smile_open_mouth', 'wink_left', 'sorrow', 'surprise_open_mouth'];
	for (const expression of expressions) {
		const miiStudioExpressionUrl = `https://studio.mii.nintendo.com/miis/image.png?data=${encodedStudioMiiData}&type=face&expression=${expression}&width=128&instanceCount=1`;
		const miiStudioExpressionImageData = await got(miiStudioExpressionUrl).buffer();
		await util.uploadCDNAsset(`${userMiiKey}/${expression}.png`, miiStudioExpressionImageData);
	}

	const miiStudioBodyUrl = `https://studio.mii.nintendo.com/miis/image.png?data=${encodedStudioMiiData}&type=all_body&width=270&instanceCount=1`;
	const miiStudioBodyImageData = await got(miiStudioBodyUrl).buffer();
	await util.uploadCDNAsset(`${userMiiKey}/body.png`, miiStudioBodyImageData);
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
	await this.generateMiiImages();
	
	const primaryHash = util.nintendoPasswordHash(this.get('password'), this.get('pid'));
	const hash = bcrypt.hashSync(primaryHash, 10);

	this.set('password', hash);
	next();
});

const PNID = model('PNID', PNIDSchema);

module.exports = {
	PNIDSchema,
	PNID
};