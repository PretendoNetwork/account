import crypto from 'node:crypto';
import { Schema, model } from 'mongoose';
import uniqueValidator from 'mongoose-unique-validator';
import imagePixels from 'image-pixels';
import TGA from 'tga';
import got from 'got';
import Mii from 'mii-js';
import { DeviceSchema } from '@/models/device';
import util from '@/util';
import { IPNID, IPNIDMethods, PNIDModel } from '@/types/mongoose/pnid';

const PNIDSchema = new Schema<IPNID, PNIDModel, IPNIDMethods>({
	access_level: {
		type: Number,
		default: 0  // 0: standard, 1: tester, 2: mod?, 3: dev
	},
	server_access_level: {
		type: String,
		default: 'prod' // everyone is in production by default
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
	flags: {
		active: Boolean,
		marketing: Boolean,
		off_device: Boolean
	},
	devices: [DeviceSchema],
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
	},
	connections: {
		discord: {
			id: String
		}
	}
}, { id: false });

PNIDSchema.plugin(uniqueValidator, {message: '{PATH} already in use.'});

/*
	According to http://pf2m.com/tools/rank.php Nintendo PID's start at 1,800,000,000 and count down with each account
	This means the max PID is 1799999999 and hard-limits the number of potential accounts to 1,800,000,000
	The author of that site does not give any information on how they found this out, but it does seem to hold true
	https://account.nintendo.net/v1/api/admin/mapped_ids?input_type=pid&output_type=user_id&input=1800000000 returns nothing
	https://account.nintendo.net/v1/api/admin/mapped_ids?input_type=pid&output_type=user_id&input=1799999999 returns `prodtest1`
	and the next few accounts counting down seem to be admin, service and internal test accounts
*/
PNIDSchema.method('generatePID', async function generatePID(): Promise<void> {
	const min = 1000000000; // The console (WiiU) seems to not accept PIDs smaller than this
	const max = 1799999999;

	let pid =  Math.floor(Math.random() * (max - min + 1) + min);

	const inuse = await PNID.findOne({
		pid
	});

	if (inuse) {
		await this.generatePID();
	} else {
		this.set('pid', pid);
	}
});

PNIDSchema.method('generateEmailValidationCode', async function generateEmailValidationCode(): Promise<void> {
	// WiiU passes the PID along with the email code
	// Does not actually need to be unique to all users
	const code = Math.random().toFixed(6).split('.')[1]; // Dirty one-liner to generate numbers of 6 length and padded 0

	this.set('identification.email_code', code);
});

PNIDSchema.method('generateEmailValidationToken', async function generateEmailValidationToken(): Promise<void> {
	let token = crypto.randomBytes(32).toString('hex');

	const inuse = await PNID.findOne({
		'identification.email_token': token
	});

	if (inuse) {
		await this.generateEmailValidationToken();
	} else {
		this.set('identification.email_token', token);
	}
});

PNIDSchema.method('updateMii', async function updateMii({name, primary, data}): Promise<void> {
	this.set('mii.name', name);
	this.set('mii.primary', primary === 'Y');
	this.set('mii.data', data);
	this.set('mii.hash', crypto.randomBytes(7).toString('hex'));
	this.set('mii.id', crypto.randomBytes(4).readUInt32LE());
	this.set('mii.image_id', crypto.randomBytes(4).readUInt32LE());

	await this.generateMiiImages();

	await this.save();
});

PNIDSchema.method('generateMiiImages', async function generateMiiImages(): Promise<void> {
	const miiData = this.get('mii.data');
	const mii = new Mii(Buffer.from(miiData, 'base64'));
	const miiStudioUrl = mii.studioUrl({
		type: 'face',
		width: '128',
		instanceCount: '1',
	});
	const miiStudioNormalFaceImageData = await got(miiStudioUrl).buffer();
	const pngData = await imagePixels(miiStudioNormalFaceImageData);
	const tga = TGA.createTgaBuffer(pngData.width, pngData.height, pngData.data);

	const userMiiKey = `mii/${this.get('pid')}`;

	await util.uploadCDNAsset('pn-cdn', `${userMiiKey}/standard.tga`, tga, 'public-read');
	await util.uploadCDNAsset('pn-cdn', `${userMiiKey}/normal_face.png`, miiStudioNormalFaceImageData, 'public-read');

	const expressions = ['frustrated', 'smile_open_mouth', 'wink_left', 'sorrow', 'surprise_open_mouth'];
	for (const expression of expressions) {
		const miiStudioExpressionUrl = mii.studioUrl({
			type: 'face',
			expression: expression,
			width: '128',
			instanceCount: '1',
		});
		const miiStudioExpressionImageData = await got(miiStudioExpressionUrl).buffer();
		await util.uploadCDNAsset('pn-cdn', `${userMiiKey}/${expression}.png`, miiStudioExpressionImageData, 'public-read');
	}

	const miiStudioBodyUrl = mii.studioUrl({
		type: 'all_body',
		width: '270',
		instanceCount: '1',
	});
	const miiStudioBodyImageData = await got(miiStudioBodyUrl).buffer();
	await util.uploadCDNAsset('pn-cdn', `${userMiiKey}/body.png`, miiStudioBodyImageData, 'public-read');
});

PNIDSchema.method('getServerMode', function getServerMode(): string {
	const serverMode = this.get('server_mode') || 'prod';

	return serverMode;
});

export const PNID: PNIDModel = model<IPNID, PNIDModel>('PNID', PNIDSchema);