const router = require('express').Router();
const emailvalidator = require('email-validator');
const fs = require('fs-extra');
const moment = require('moment');
const crypto = require('crypto');
const { PNID } = require('../../../../models/pnid');
const { NEXAccount } = require('../../../../models/nex-account');
const database = require('../../../../database');
const util = require('../../../../util');

/**
 * [POST]
 * Implementation of: https://api.pretendo.cc/v1/register
 * Description: Creates a new user PNID
 */
router.post('/', async (request, response) => {
	const { body } = request;
	const { email, username, mii_name, password, password_confirm } = body;

	if (!email || email.trim() === '' || !emailvalidator.validate(email)) {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid email address'
		});
	}

	if (!username || username.trim() === '') {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid username'
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

	const userExists = await database.doesUserExist(username);

	if (userExists) {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'PNID username already in use'
		});
	}

	if (!mii_name || mii_name.trim() === '') {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid Mii name'
		});
	}

	if (!password || password.trim() === '') {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid password'
		});
	}

	if (password !== password_confirm) {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Passwords are not matching'
		});
	}

	const miiNameBuffer = Buffer.from(mii_name, 'utf16le'); // UTF8 to UTF16

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
			name: mii_name,
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
	await NEXAccount.updateOne({
		pid: newNEXAccount.get('pid')
	}, {
		owning_pid: newNEXAccount.get('pid')
	});

	const cryptoPath = `${__dirname}/../../../../../certs/access`;

	if (!fs.pathExistsSync(cryptoPath)) {
		// Need to generate keys
		return response.status(500).json({
			app: 'api',
			status: 500,
			error: 'Failed to locate crypto keys. Please contact an administrator'
		});
	}

	const publicKey = fs.readFileSync(`${cryptoPath}/public.pem`);
	const hmacSecret = fs.readFileSync(`${cryptoPath}/secret.key`);

	const cryptoOptions = {
		public_key: publicKey,
		hmac_secret: hmacSecret
	};

	const accessTokenOptions = {
		system_type: 0xF, // API
		token_type: 0x1, // OAuth Access,
		pid: pnid.get('pid'),
		access_level: pnid.get('access_level'),
		title_id: BigInt(0),
		expire_time: BigInt(Date.now() + (3600 * 1000))
	};

	const refreshTokenOptions = {
		system_type: 0xF, // API
		token_type: 0x2, // OAuth Refresh,
		pid: pnid.get('pid'),
		access_level: pnid.get('access_level'),
		title_id: BigInt(0),
		expire_time: BigInt(Date.now() + (3600 * 1000))
	};

	const accessToken = util.generateToken(cryptoOptions, accessTokenOptions);
	const refreshToken = util.generateToken(cryptoOptions, refreshTokenOptions);

	response.json({
		access_token: accessToken,
		token_type: 'Bearer',
		expires_in: 3600,
		refresh_token: refreshToken
	});
});

module.exports = router;