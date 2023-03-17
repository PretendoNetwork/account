
import crypto from 'node:crypto';
import express from 'express';
import emailvalidator from 'email-validator';
import bcrypt from 'bcrypt';
import fs from 'fs-extra';
import moment from 'moment';
import hcaptcha from 'hcaptcha';
import Mii from 'mii-js';
import mongoose from 'mongoose';
import { doesUserExist, connection as databaseConnection } from '@/database';
import { getServicePublicKey, getServiceSecretKey } from '@/cache';
import { nintendoPasswordHash, sendConfirmationEmail, generateToken } from '@/util';
import { LOG_ERROR } from '@/logger';
import { PNID } from '@/models/pnid';
import { NEXAccount } from '@/models/nex-account';
import { config, disabledFeatures } from '@/config-manager';
import { CryptoOptions } from '@/types/common/crypto-options';
import { TokenOptions } from '@/types/common/token-options';
import { HydratedNEXAccountDocument } from '@/types/mongoose/nex-account';
import { HydratedPNIDDocument } from '@/types/mongoose/pnid';

const router: express.Router = express.Router();

const PNID_VALID_CHARACTERS_REGEX: RegExp = /^[\w\-\.]*$/gm;
const PNID_PUNCTUATION_START_REGEX: RegExp = /^[\_\-\.]/gm;
const PNID_PUNCTUATION_END_REGEX: RegExp = /[\_\-\.]$/gm;
const PNID_PUNCTUATION_DUPLICATE_REGEX: RegExp = /[\_\-\.]{2,}/gm;

// This sucks
const PASSWORD_WORD_OR_NUMBER_REGEX: RegExp = /(?=.*[a-zA-Z])(?=.*\d).*/;
const PASSWORD_WORD_OR_PUNCTUATION_REGEX: RegExp = /(?=.*[a-zA-Z])(?=.*[\_\-\.]).*/;
const PASSWORD_NUMBER_OR_PUNCTUATION_REGEX: RegExp = /(?=.*\d)(?=.*[\_\-\.]).*/;
const PASSWORD_REPEATED_CHARACTER_REGEX: RegExp = /(.)\1\1/;

const DEFAULT_MII_DATA: Buffer = Buffer.from('AwAAQOlVognnx0GC2/uogAOzuI0n2QAAAEBEAGUAZgBhAHUAbAB0AAAAAAAAAEBAAAAhAQJoRBgmNEYUgRIXaA0AACkAUkhQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGm9', 'base64');

/**
 * [POST]
 * Implementation of: https://api.pretendo.cc/v1/register
 * Description: Creates a new user PNID
 */
router.post('/', async (request: express.Request, response: express.Response) => {
	const email: string = request.body.email?.trim();
	const username: string = request.body.username?.trim();
	const miiName: string = request.body.mii_name?.trim();
	const password: string = request.body.password?.trim();
	const passwordConfirm: string = request.body.password_confirm?.trim();
	const hCaptchaResponse: string = request.body.hCaptchaResponse?.trim();

	if (!disabledFeatures.captcha) {
		if (!hCaptchaResponse || hCaptchaResponse === '') {
			return response.status(400).json({
				app: 'api',
				status: 400,
				error: 'Must fill in captcha'
			});
		}

		const captchaVerify: VerifyResponse = await hcaptcha.verify(config.hcaptcha.secret, hCaptchaResponse);

		if (!captchaVerify.success) {
			return response.status(400).json({
				app: 'api',
				status: 400,
				error: 'Captcha verification failed'
			});
		}
	}

	if (!email || email === '') {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Must enter an email address'
		});
	}

	if (!emailvalidator.validate(email)) {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid email address'
		});
	}

	if (!username || username === '') {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Must enter a username'
		});
	}

	if (username.length < 6) {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Username is too short'
		});
	}

	if (username.length > 16) {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Username is too long'
		});
	}

	if (!PNID_VALID_CHARACTERS_REGEX.test(username)) {
		console.log(Buffer.from(username));
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Username contains invalid characters'
		});
	}

	if (PNID_PUNCTUATION_START_REGEX.test(username)) {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Username cannot begin with punctuation characters'
		});
	}

	if (PNID_PUNCTUATION_END_REGEX.test(username)) {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Username cannot end with punctuation characters'
		});
	}

	if (PNID_PUNCTUATION_DUPLICATE_REGEX.test(username)) {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Two or more punctuation characters cannot be used in a row'
		});
	}

	const userExists: boolean = await doesUserExist(username);

	if (userExists) {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'PNID already in use'
		});
	}

	if (!miiName || miiName === '') {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Must enter a Mii name'
		});
	}

	if (!password || password === '') {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Must enter a password'
		});
	}

	if (password.length < 6) {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Password is too short'
		});
	}

	if (password.length > 16) {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Password is too long'
		});
	}

	if (password.toLowerCase() === username.toLowerCase()) {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Password cannot be the same as username'
		});
	}

	if (!PASSWORD_WORD_OR_NUMBER_REGEX.test(password) && !PASSWORD_WORD_OR_PUNCTUATION_REGEX.test(password) && !PASSWORD_NUMBER_OR_PUNCTUATION_REGEX.test(password)) {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Password must have combination of letters, numbers, and/or punctuation characters'
		});
	}

	if (PASSWORD_REPEATED_CHARACTER_REGEX.test(password)) {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Password may not have 3 repeating characters'
		});
	}

	if (password !== passwordConfirm) {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Passwords do not match'
		});
	}

	const miiNameBuffer: Buffer = Buffer.from(miiName, 'utf16le'); // UTF8 to UTF16

	if (miiNameBuffer.length > 0x14) {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Mii name too long'
		});
	}

	const mii: Mii = new Mii(DEFAULT_MII_DATA);
	mii.miiName = miiName;

	const creationDate: string = moment().format('YYYY-MM-DDTHH:MM:SS');
	let pnid: HydratedPNIDDocument;
	let nexAccount: HydratedNEXAccountDocument;

	const session: mongoose.ClientSession = await databaseConnection().startSession();
	await session.startTransaction();

	try {
		// * PNIDs can only be registered from a Wii U
		// * So assume website users are WiiU NEX accounts
		nexAccount = new NEXAccount({
			device_type: 'wiiu',
		});

		await nexAccount.generatePID();
		await nexAccount.generatePassword();

		// Quick hack to get the PIDs to match
		// TODO: Change this maybe?
		// NN with a NNID will always use the NNID PID
		// even if the provided NEX PID is different
		// To fix this we make them the same PID
		nexAccount.owning_pid = nexAccount.get('pid');

		await nexAccount.save({ session });

		const primaryPasswordHash: string = nintendoPasswordHash(password, nexAccount.get('pid'));
		const passwordHash: string = await bcrypt.hash(primaryPasswordHash, 10);

		pnid = new PNID({
			pid: nexAccount.get('pid'),
			creation_date: creationDate,
			updated: creationDate,
			username: username,
			usernameLower: username.toLowerCase(),
			password: passwordHash,
			birthdate: '1990-01-01', // TODO: Change this
			gender: 'M', // TODO: Change this
			country: 'US', // TODO: Change this
			language: 'en', // TODO: Change this
			email: {
				address: email.toLowerCase(),
				primary: true, // TODO: Change this
				parent: true, // TODO: Change this
				reachable: false, // TODO: Change this
				validated: false, // TODO: Change this
				id: crypto.randomBytes(4).readUInt32LE()
			},
			region: 0x310B0000, // TODO: Change this
			timezone: {
				name: 'America/New_York', // TODO: Change this
				offset: -14400 // TODO: Change this
			},
			mii: {
				name: miiName,
				primary: true, // TODO: Change this
				data: mii.encode().toString('base64'),
				id: crypto.randomBytes(4).readUInt32LE(),
				hash: crypto.randomBytes(7).toString('hex'),
				image_url: '', // deprecated, will be removed in the future
				image_id: crypto.randomBytes(4).readUInt32LE()
			},
			flags: {
				active: true, // TODO: Change this
				marketing: true, // TODO: Change this
				off_device: true // TODO: Change this
			},
			identification: {
				email_code: 1, // will be overwritten before saving
				email_token: '' // will be overwritten before saving
			}
		});

		await pnid.generateEmailValidationCode();
		await pnid.generateEmailValidationToken();
		await pnid.generateMiiImages();

		await pnid.save({ session });

		await session.commitTransaction();
	} catch (error) {
		LOG_ERROR('[POST] /v1/register: ' + error);

		await session.abortTransaction();

		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Password must have combination of letters, numbers, and/or punctuation characters'
		});
	} finally {
		// * This runs regardless of failure
		// * Returning on catch will not prevent this from running
		await session.endSession();
	}

	await sendConfirmationEmail(pnid);

	const cryptoPath: string = `${__dirname}/../../../../../certs/service/account`;

	if (!await fs.pathExists(cryptoPath)) {
		// Need to generate keys
		return response.status(500).json({
			app: 'api',
			status: 500,
			error: 'Failed to locate crypto keys. Please contact an administrator'
		});
	}

	const publicKey: Buffer = await getServicePublicKey('account');
	const secretKey: Buffer = await getServiceSecretKey('account');

	const cryptoOptions: CryptoOptions = {
		public_key: publicKey,
		hmac_secret: secretKey
	};

	const accessTokenOptions: TokenOptions = {
		system_type: 0xF, // API
		token_type: 0x1, // OAuth Access,
		pid: pnid.get('pid'),
		access_level: 0,
		title_id: BigInt(0),
		expire_time: BigInt(Date.now() + (3600 * 1000))
	};

	const refreshTokenOptions: TokenOptions = {
		system_type: 0xF, // API
		token_type: 0x2, // OAuth Refresh,
		pid: pnid.get('pid'),
		access_level: 0,
		title_id: BigInt(0),
		expire_time: BigInt(Date.now() + (3600 * 1000))
	};

	const accessToken: string = await generateToken(cryptoOptions, accessTokenOptions);
	const refreshToken: string = await generateToken(cryptoOptions, refreshTokenOptions);

	response.json({
		access_token: accessToken,
		token_type: 'Bearer',
		expires_in: 3600,
		refresh_token: refreshToken
	});
});

export default router;