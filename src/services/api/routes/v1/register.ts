
import crypto from 'node:crypto';
import express from 'express';
import emailvalidator from 'email-validator';
import bcrypt from 'bcrypt';
import moment from 'moment';
import hcaptcha from 'hcaptcha';
import Mii from 'mii-js';
import { doesPNIDExist, connection as databaseConnection } from '@/database';
import { nintendoPasswordHash, sendConfirmationEmail, generateToken } from '@/util';
import { LOG_ERROR } from '@/logger';
import { PNID } from '@/models/pnid';
import { NEXAccount } from '@/models/nex-account';
import { config, disabledFeatures } from '@/config-manager';
import { HydratedNEXAccountDocument } from '@/types/mongoose/nex-account';
import { HydratedPNIDDocument } from '@/types/mongoose/pnid';

const router = express.Router();

const PNID_VALID_CHARACTERS_REGEX = /^[\w\-.]*$/;
const PNID_PUNCTUATION_START_REGEX = /^[_\-.]/;
const PNID_PUNCTUATION_END_REGEX = /[_\-.]$/;
const PNID_PUNCTUATION_DUPLICATE_REGEX = /[_\-.]{2,}/;

// * This sucks
const PASSWORD_WORD_OR_NUMBER_REGEX = /(?=.*[a-zA-Z])(?=.*\d).*/;
const PASSWORD_WORD_OR_PUNCTUATION_REGEX = /(?=.*[a-zA-Z])(?=.*[_\-.]).*/;
const PASSWORD_NUMBER_OR_PUNCTUATION_REGEX = /(?=.*\d)(?=.*[_\-.]).*/;
const PASSWORD_REPEATED_CHARACTER_REGEX = /(.)\1\1/;

const DEFAULT_MII_DATA = Buffer.from('AwAAQOlVognnx0GC2/uogAOzuI0n2QAAAEBEAGUAZgBhAHUAbAB0AAAAAAAAAEBAAAAhAQJoRBgmNEYUgRIXaA0AACkAUkhQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGm9', 'base64');

/**
 * [POST]
 * Implementation of: https://api.pretendo.cc/v1/register
 * Description: Creates a new user PNID
 */
router.post('/', async (request: express.Request, response: express.Response): Promise<void> => {
	const email = request.body.email?.trim();
	const username = request.body.username?.trim();
	const miiName = request.body.mii_name?.trim();
	const password = request.body.password?.trim();
	const passwordConfirm = request.body.password_confirm?.trim();
	const hCaptchaResponse = request.body.hCaptchaResponse?.trim();

	if (!disabledFeatures.captcha) {
		if (!hCaptchaResponse || hCaptchaResponse === '') {
			response.status(400).json({
				app: 'api',
				status: 400,
				error: 'Must fill in captcha'
			});

			return;
		}

		const captchaVerify = await hcaptcha.verify(config.hcaptcha.secret, hCaptchaResponse);

		if (!captchaVerify.success) {
			response.status(400).json({
				app: 'api',
				status: 400,
				error: 'Captcha verification failed'
			});

			return;
		}
	}

	if (!email || email === '') {
		response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Must enter an email address'
		});

		return;
	}

	if (!emailvalidator.validate(email)) {
		response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid email address'
		});

		return;
	}

	if (!username || username === '') {
		response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Must enter a username'
		});

		return;
	}

	if (username.length < 6) {
		response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Username is too short'
		});

		return;
	}

	if (username.length > 16) {
		response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Username is too long'
		});

		return;
	}

	if (!PNID_VALID_CHARACTERS_REGEX.test(username)) {
		console.log(Buffer.from(username));
		response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Username contains invalid characters'
		});

		return;
	}

	if (PNID_PUNCTUATION_START_REGEX.test(username)) {
		response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Username cannot begin with punctuation characters'
		});

		return;
	}

	if (PNID_PUNCTUATION_END_REGEX.test(username)) {
		response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Username cannot end with punctuation characters'
		});

		return;
	}

	if (PNID_PUNCTUATION_DUPLICATE_REGEX.test(username)) {
		response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Two or more punctuation characters cannot be used in a row'
		});

		return;
	}

	const userExists = await doesPNIDExist(username);

	if (userExists) {
		response.status(400).json({
			app: 'api',
			status: 400,
			error: 'PNID already in use'
		});

		return;
	}

	if (!miiName || miiName === '') {
		response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Must enter a Mii name'
		});

		return;
	}

	if (!password || password === '') {
		response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Must enter a password'
		});

		return;
	}

	if (password.length < 6) {
		response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Password is too short'
		});

		return;
	}

	if (password.length > 16) {
		response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Password is too long'
		});

		return;
	}

	if (password.toLowerCase() === username.toLowerCase()) {
		response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Password cannot be the same as username'
		});

		return;
	}

	if (!PASSWORD_WORD_OR_NUMBER_REGEX.test(password) && !PASSWORD_WORD_OR_PUNCTUATION_REGEX.test(password) && !PASSWORD_NUMBER_OR_PUNCTUATION_REGEX.test(password)) {
		response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Password must have combination of letters, numbers, and/or punctuation characters'
		});

		return;
	}

	if (PASSWORD_REPEATED_CHARACTER_REGEX.test(password)) {
		response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Password may not have 3 repeating characters'
		});

		return;
	}

	if (password !== passwordConfirm) {
		response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Passwords do not match'
		});

		return;
	}

	const miiNameBuffer = Buffer.from(miiName, 'utf16le'); // * UTF8 to UTF16

	if (miiNameBuffer.length > 0x14) {
		response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Mii name too long'
		});

		return;
	}

	const mii = new Mii(DEFAULT_MII_DATA);
	mii.miiName = miiName;

	const creationDate = moment().format('YYYY-MM-DDTHH:MM:SS');
	let pnid: HydratedPNIDDocument;
	let nexAccount: HydratedNEXAccountDocument;

	const session = await databaseConnection().startSession();
	await session.startTransaction();

	try {
		// * PNIDs can only be registered from a Wii U
		// * So assume website users are WiiU NEX accounts
		nexAccount = new NEXAccount({
			device_type: 'wiiu',
		});

		await nexAccount.generatePID();
		await nexAccount.generatePassword();

		// * Quick hack to get the PIDs to match
		// TODO - Change this maybe?
		// * NN with a NNID will always use the NNID PID
		// * even if the provided NEX PID is different
		// * To fix this we make them the same PID
		nexAccount.owning_pid = nexAccount.pid;

		await nexAccount.save({ session });

		const primaryPasswordHash = nintendoPasswordHash(password, nexAccount.pid);
		const passwordHash = await bcrypt.hash(primaryPasswordHash, 10);

		pnid = new PNID({
			pid: nexAccount.pid,
			creation_date: creationDate,
			updated: creationDate,
			username: username,
			usernameLower: username.toLowerCase(),
			password: passwordHash,
			birthdate: '1990-01-01', // TODO - Change this
			gender: 'M', // TODO - Change this
			country: 'US', // TODO - Change this
			language: 'en', // TODO - Change this
			email: {
				address: email.toLowerCase(),
				primary: true, // TODO - Change this
				parent: true, // TODO - Change this
				reachable: false, // TODO - Change this
				validated: false, // TODO - Change this
				id: crypto.randomBytes(4).readUInt32LE()
			},
			region: 0x310B0000, // TODO - Change this
			timezone: {
				name: 'America/New_York', // TODO - Change this
				offset: -14400 // TODO - Change this
			},
			mii: {
				name: miiName,
				primary: true, // TODO - Change this
				data: mii.encode().toString('base64'),
				id: crypto.randomBytes(4).readUInt32LE(),
				hash: crypto.randomBytes(7).toString('hex'),
				image_url: '', // * deprecated, will be removed in the future
				image_id: crypto.randomBytes(4).readUInt32LE()
			},
			flags: {
				active: true, // TODO - Change this
				marketing: true, // TODO - Change this
				off_device: true // TODO - Change this
			},
			identification: {
				email_code: 1, // * will be overwritten before saving
				email_token: '' // * will be overwritten before saving
			}
		});

		await pnid.generateEmailValidationCode();
		await pnid.generateEmailValidationToken();
		await pnid.generateMiiImages();

		await pnid.save({ session });

		await session.commitTransaction();
	} catch (error: any) {
		LOG_ERROR('[POST] /v1/register: ' + error);
		if (error.stack) console.error(error.stack)

		await session.abortTransaction();

		response.status(500).json({
			app: 'api',
			status: 500,
			error: 'Internal server error'
		});

		return;
	} finally {
		// * This runs regardless of failure
		// * Returning on catch will not prevent this from running
		await session.endSession();
	}

	await sendConfirmationEmail(pnid);

	const accessTokenOptions = {
		system_type: 0x3, // * API
		token_type: 0x1, // * OAuth Access
		pid: pnid.pid,
		access_level: pnid.access_level,
		title_id: BigInt(0),
		expire_time: BigInt(Date.now() + (3600 * 1000))
	};

	const refreshTokenOptions = {
		system_type: 0x3, // * API
		token_type: 0x2, // * OAuth Refresh
		pid: pnid.pid,
		access_level: pnid.access_level,
		title_id: BigInt(0),
		expire_time: BigInt(Date.now() + (3600 * 1000))
	};

	const accessTokenBuffer = await generateToken(config.aes_key, accessTokenOptions);
	const refreshTokenBuffer = await generateToken(config.aes_key, refreshTokenOptions);

	const accessToken = accessTokenBuffer ? accessTokenBuffer.toString('hex') : '';
	const refreshToken = refreshTokenBuffer ? refreshTokenBuffer.toString('hex') : '';

	// TODO - Handle null tokens

	response.json({
		access_token: accessToken,
		token_type: 'Bearer',
		expires_in: 3600,
		refresh_token: refreshToken
	});
});

export default router;