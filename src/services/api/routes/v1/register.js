const router = require('express').Router();
const emailvalidator = require('email-validator');
const fs = require('fs-extra');
const moment = require('moment');
const crypto = require('crypto');
const hcaptcha = require('hcaptcha');
const { PNID } = require('../../../../models/pnid');
const { NEXAccount } = require('../../../../models/nex-account');
const database = require('../../../../database');
const util = require('../../../../util');
const config = require('../../../../../config');

const PNID_VALID_CHARACTERS_REGEX = /^[\w\-\.]*$/gm;
const PNID_PUNCTUATION_START_REGEX = /^[\_\-\.]/gm;
const PNID_PUNCTUATION_END_REGEX = /[\_\-\.]$/gm;
const PNID_PUNCTUATION_DUPLICATE_REGEX = /[\_\-\.]{2,}/gm;

// This sucks
const PASSWORD_WORD_OR_NUMBER_REGEX = /(?=.*[a-zA-Z])(?=.*\d).*/;
const PASSWORD_WORD_OR_PUNCTUATION_REGEX = /(?=.*[a-zA-Z])(?=.*[\_\-\.]).*/;
const PASSWORD_NUMBER_OR_PUNCTUATION_REGEX = /(?=.*\d)(?=.*[\_\-\.]).*/;
const PASSWORD_REPEATED_CHARACTER_REGEX = /(.)\1\1/;

/**
 * [POST]
 * Implementation of: https://api.pretendo.cc/v1/register
 * Description: Creates a new user PNID
 */
router.post('/', async (request, response) => {
	const { body } = request;
	
	const email = body.email?.trim();
	const username = body.username?.trim();
	const miiName = body.mii_name?.trim();
	const password = body.password?.trim();
	const passwordConfirm = body.password_confirm?.trim();
	const hCaptchaResponse = body.hCaptchaResponse?.trim();

	if (!hCaptchaResponse || hCaptchaResponse === '') {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Must fill in captcha'
		});
	}

	const captchaVerify = await hcaptcha.verify(config.hcaptcha.secret, hCaptchaResponse);

	if (!captchaVerify.success) {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Captcha verification failed'
		});
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

	const userExists = await database.doesUserExist(username);

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

	const miiNameBuffer = Buffer.from(miiName, 'utf16le'); // UTF8 to UTF16

	if (miiNameBuffer.length > 0x14) {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Mii name too long'
		});
	}

	// Default Mii data before Mii name
	const MII_DATA_FIRST = Buffer.from([
		0x03, 0x00, 0x00, 0x40, 0xE9, 0x55, 0xA2, 0x09,
		0xE7, 0xC7, 0x41, 0x82, 0xDA, 0xA8, 0xE1, 0x77,
		0x03, 0xB3, 0xB8, 0x8D, 0x27, 0xD9, 0x00, 0x00,
		0x00, 0x60
	]);

	const MII_DATA_NAME = Buffer.alloc(0x14); // Max Mii name length

	// Default Mii data after Mii name
	const MII_DATA_LAST = Buffer.from([
		0x40, 0x40, 0x00, 0x00, 0x21, 0x01, 0x02, 0x68,
		0x44, 0x18, 0x26, 0x34, 0x46, 0x14, 0x81, 0x12,
		0x17, 0x68, 0x0D, 0x00, 0x00, 0x29, 0x00, 0x52,
		0x48, 0x50, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x7C, 0x2E
	]);

	miiNameBuffer.copy(MII_DATA_NAME); // Move Mii name into padded buffer

	const MII_DATA = Buffer.concat([MII_DATA_FIRST, MII_DATA_NAME, MII_DATA_LAST]); // Build Mii data

	// Create new NEX account
	const newNEXAccount = new NEXAccount({
		pid: 0,
		password: '',
		owning_pid: 0,
	});
	await newNEXAccount.save();

	const creationDate = moment().format('YYYY-MM-DDTHH:MM:SS');

	const document = {
		pid: newNEXAccount.get('pid'),
		creation_date: creationDate,
		updated: creationDate,
		username: username,
		password: password, // will be hashed before saving
		birthdate: '1990-01-01', // TODO: Change this
		gender: 'M', // TODO: Change this
		country: 'US', // TODO: Change this
		language: 'en', // TODO: Change this
		email: {
			address: email,
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
			data: MII_DATA.toString('base64'),
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
		validation: {
			email_code: 1, // will be overwritten before saving
			email_token: '' // will be overwritten before saving
		}
	};

	const pnid = new PNID(document);
	await pnid.save();

	// Quick hack to get the PIDs to match
	// TODO: Change this
	// NN with a NNID will always use the NNID PID
	// even if the provided NEX PID is different
	// To fix this we make them the same PID
	await NEXAccount.updateOne({ pid: newNEXAccount.get('pid') }, {
		owning_pid: newNEXAccount.get('pid')
	});

	const cryptoPath = `${__dirname}/../../../../../certs/access`;

	if (!await fs.pathExists(cryptoPath)) {
		// Need to generate keys
		return response.status(500).json({
			app: 'api',
			status: 500,
			error: 'Failed to locate crypto keys. Please contact an administrator'
		});
	}

	let publicKey = cache.getServicePublicKey('account');
	if (publicKey === null) {
		publicKey = await fs.readFile(`${cryptoPath}/public.pem`);
		await cache.setServicePublicKey('account', publicKey);
	}

	let secretKey = cache.getServiceSecretKey('account');
	if (secretKey === null) {
		secretKey = await fs.readFile(`${cryptoPath}/secret.key`);
		await cache.setServiceSecretKey('account', secretKey);
	}

	const cryptoOptions = {
		public_key: publicKey,
		hmac_secret: secretKey
	};

	const accessTokenOptions = {
		system_type: 0xF, // API
		token_type: 0x1, // OAuth Access,
		pid: pnid.get('pid'),
		access_level: 0,
		title_id: BigInt(0),
		expire_time: BigInt(Date.now() + (3600 * 1000))
	};

	const refreshTokenOptions = {
		system_type: 0xF, // API
		token_type: 0x2, // OAuth Refresh,
		pid: pnid.get('pid'),
		access_level: 0,
		title_id: BigInt(0),
		expire_time: BigInt(Date.now() + (3600 * 1000))
	};

	const accessToken = await util.generateToken(cryptoOptions, accessTokenOptions);
	const refreshToken = await util.generateToken(cryptoOptions, refreshTokenOptions);

	response.json({
		access_token: accessToken,
		token_type: 'Bearer',
		expires_in: 3600,
		refresh_token: refreshToken
	});
});

module.exports = router;