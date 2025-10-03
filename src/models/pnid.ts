import crypto from 'node:crypto';
import { Schema, model } from 'mongoose';
import uniqueValidator from 'mongoose-unique-validator';
import imagePixels from 'image-pixels';
import TGA from 'tga';
import got from 'got';
import Mii from 'mii-js';
import Stripe from 'stripe';
import { DeviceSchema } from '@/models/device';
import { uploadCDNAsset } from '@/util';
import { LOG_ERROR, LOG_WARN } from '@/logger';
import { config } from '@/config-manager';
import type { IPNID, IPNIDMethods, PNIDModel } from '@/types/mongoose/pnid';
import type { PNIDPermissionFlag } from '@/types/common/permission-flags';

let stripe: Stripe;

if (config.stripe?.secret_key) {
	stripe = new Stripe(config.stripe.secret_key, {
		apiVersion: '2022-11-15',
		typescript: true
	});
}

const PNIDSchema = new Schema<IPNID, PNIDModel, IPNIDMethods>({
	deleted: {
		type: Boolean,
		default: false
	},
	permissions: {
		type: BigInt,
		default: 0n
	},
	access_level: {
		type: Number,
		default: 0 // * 0: standard, 1: tester, 2: mod?, 3: dev
	},
	server_access_level: {
		type: String,
		default: 'prod' // * everyone is in production by default
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
		id: Number
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
		id: Number,
		hash: String,
		image_url: String,
		image_id: Number
	},
	flags: {
		active: Boolean,
		marketing: Boolean,
		off_device: Boolean
	},
	devices: [DeviceSchema],
	identification: { // * user identification tokens
		email_code: String,
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
		},
		stripe: {
			customer_id: String,
			subscription_id: String,
			price_id: String,
			tier_level: Number,
			tier_name: String,
			latest_webhook_timestamp: Number
		}
	}
}, { id: false });

PNIDSchema.plugin(uniqueValidator, { message: '{PATH} already in use.' });

/*
	According to http://pf2m.com/tools/rank.php Nintendo PID's start at 1,800,000,000 and count down with each account
	This means the max PID is 1799999999 and hard-limits the number of potential accounts to 1,800,000,000
	The author of that site does not give any information on how they found this out, but it does seem to hold true
	https://account.nintendo.net/v1/api/admin/mapped_ids?input_type=pid&output_type=user_id&input=1800000000 returns nothing
	https://account.nintendo.net/v1/api/admin/mapped_ids?input_type=pid&output_type=user_id&input=1799999999 returns `prodtest1`
	and the next few accounts counting down seem to be admin, service and internal test accounts
*/
PNIDSchema.method('generatePID', async function generatePID(): Promise<void> {
	const min = 1000000000; // * The console (WiiU) seems to not accept PIDs smaller than this
	const max = 1799999999;

	const pid = Math.floor(Math.random() * (max - min + 1) + min);

	const inuse = await PNID.findOne({
		pid
	});

	if (inuse) {
		await this.generatePID();
	} else {
		this.pid = pid;
	}
});

PNIDSchema.method('generateEmailValidationCode', async function generateEmailValidationCode(): Promise<void> {
	// * WiiU passes the PID along with the email code
	// * Does not actually need to be unique to all users
	const code = Math.random().toFixed(6).split('.')[1]; // * Dirty one-liner to generate numbers of 6 length and padded 0

	this.identification.email_code = code;
});

PNIDSchema.method('generateEmailValidationToken', async function generateEmailValidationToken(): Promise<void> {
	const token = crypto.randomBytes(32).toString('hex');

	const inuse = await PNID.findOne({
		'identification.email_token': token
	});

	if (inuse) {
		await this.generateEmailValidationToken();
	} else {
		this.identification.email_token = token;
	}
});

PNIDSchema.method('updateMii', async function updateMii({ name, primary, data }: { name: string; primary: string; data: string }): Promise<void> {
	this.mii.name = name;
	this.mii.primary = primary === 'Y';
	this.mii.data = data;
	this.mii.hash = crypto.randomBytes(7).toString('hex');
	this.mii.id = crypto.randomBytes(4).readUInt32LE();
	this.mii.image_id = crypto.randomBytes(4).readUInt32LE();

	await this.generateMiiImages();

	await this.save();
});

PNIDSchema.method('generateMiiImages', async function generateMiiImages(): Promise<void> {
	const miiData = this.mii.data;
	const mii = new Mii(Buffer.from(miiData, 'base64'));
	const miiStudioUrl = mii.studioUrl({
		type: 'face',
		width: 128,
		instanceCount: 1
	});
	const miiStudioNormalFaceImageData = await got(miiStudioUrl).buffer();
	const pngData = await imagePixels(miiStudioNormalFaceImageData);
	const tga = TGA.createTgaBuffer(pngData.width, pngData.height, Uint8Array.from(pngData.data), false);

	const userMiiKey = `mii/${this.pid}`;

	await uploadCDNAsset(config.s3.bucket, `${userMiiKey}/standard.tga`, tga, 'public-read');
	await uploadCDNAsset(config.s3.bucket, `${userMiiKey}/normal_face.png`, miiStudioNormalFaceImageData, 'public-read');

	const expressions = ['frustrated', 'smile_open_mouth', 'wink_left', 'sorrow', 'surprise_open_mouth'];
	for (const expression of expressions) {
		const miiStudioExpressionUrl = mii.studioUrl({
			type: 'face',
			expression: expression,
			width: 128,
			instanceCount: 1
		});
		const miiStudioExpressionImageData = await got(miiStudioExpressionUrl).buffer();
		await uploadCDNAsset(config.s3.bucket, `${userMiiKey}/${expression}.png`, miiStudioExpressionImageData, 'public-read');
	}

	const miiStudioBodyUrl = mii.studioUrl({
		type: 'all_body',
		width: 270,
		instanceCount: 1
	});
	const miiStudioBodyImageData = await got(miiStudioBodyUrl).buffer();
	await uploadCDNAsset(config.s3.bucket, `${userMiiKey}/body.png`, miiStudioBodyImageData, 'public-read');
});

PNIDSchema.method('scrub', async function scrub() {
	// * Remove all personal info from a PNID
	// * Username and PID remain so thye do not get assigned again

	if (this.connections?.stripe?.customer_id) {
		try {
			const customerID = this.connections.stripe.customer_id;

			if (stripe) {
				const customer = await stripe.customers.retrieve(customerID);

				if (!customer.deleted) {
					// * Deleting will also cancel subscriptions automatically
					await stripe.customers.del(customerID);
				}
			} else {
				LOG_WARN(`SCRUBBING USER DATA FOR USER ${this.username}. HAS STRIPE DATA UDER ID ${this.connections.stripe.customer_id}, BUT STRIPE CLIENT NOT ENABLED.`);
			}
		} catch (error) {
			LOG_ERROR(`ERROR REMOVING ${this.username} STRIPE DATA. ${error}`);
		}
	}

	await this.updateMii({
		name: 'Default',
		primary: 'Y',
		data: 'AwAAQOlVognnx0GC2/uogAOzuI0n2QAAAEBEAGUAZgBhAHUAbAB0AAAAAAAAAEBAAAAhAQJoRBgmNEYUgRIXaA0AACkAUkhQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGm9'
	});

	this.deleted = true;
	this.access_level = 0;
	this.server_access_level = 'prod';
	this.creation_date = '';
	this.birthdate = '';
	this.gender = '';
	this.country = '';
	this.language = '';
	this.email.address = '';
	this.email.primary = false;
	this.email.parent = false;
	this.email.reachable = false;
	this.email.validated = false;
	this.email.validated_date = '';
	this.email.id = 0;
	this.region = 0;
	this.timezone.name = '';
	this.timezone.offset = 0;
	this.mii.id = 0;
	this.mii.hash = '';
	this.mii.image_url = '';
	this.mii.image_id = 0;
	this.flags.active = false;
	this.flags.marketing = false;
	this.flags.off_device = false;
	this.connections.discord.id = '';
	this.connections.stripe.customer_id = '';
	this.connections.stripe.subscription_id = '';
	this.connections.stripe.price_id = '';
	this.connections.stripe.tier_level = 0;
	this.connections.stripe.tier_name = '';
	this.connections.stripe.latest_webhook_timestamp = 0;
});

PNIDSchema.method('hasPermission', function hasPermission(flag: PNIDPermissionFlag): boolean {
	return (this.permissions & flag) === flag;
});

PNIDSchema.method('addPermission', function addPermission(flag: PNIDPermissionFlag): void {
	this.permissions |= flag;
});

PNIDSchema.method('clearPermission', function clearPermission(flag: PNIDPermissionFlag): void {
	this.permissions &= ~flag;
});

export const PNID = model<IPNID, PNIDModel>('PNID', PNIDSchema);
