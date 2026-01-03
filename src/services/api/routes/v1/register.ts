import crypto from 'node:crypto';
import express from 'express';
import emailvalidator from 'email-validator';
import bcrypt from 'bcrypt';
import moment from 'moment';
import hcaptcha from 'hcaptcha';
import Mii from 'mii-js';
import { doesPNIDExist, connection as databaseConnection } from '@/database';
import { isValidBirthday, getAgeFromDate, nintendoPasswordHash, sendConfirmationEmail } from '@/util';
import IP2LocationManager from '@/ip2location';
import { SystemType } from '@/types/common/system-types';
import { TokenType } from '@/types/common/token-types';
import { LOG_ERROR } from '@/logger';
import { PNID } from '@/models/pnid';
import { OAuthToken } from '@/models/oauth_token';
import { NEXAccount } from '@/models/nex-account';
import { config, disabledFeatures } from '@/config-manager';
import type { HydratedNEXAccountDocument } from '@/types/mongoose/nex-account';
import type { HydratedPNIDDocument } from '@/types/mongoose/pnid';

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
	const clientIP = request.body.ip?.trim(); // * This has to be forwarded since this request comes from the websites server
	const birthday = request.body.birthday?.trim();
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

	if (!clientIP || clientIP === '') {
		response.status(400).json({
			app: 'api',
			status: 400,
			error: 'IP must be forwarded to check local laws'
		});

		return;
	}

	if (!birthday || birthday === '') {
		response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Birthday must be set'
		});

		return;
	}

	if (!isValidBirthday(birthday)) {
		response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Birthday must be a valid date'
		});

		return;
	}

	const age = getAgeFromDate(birthday);

	if (age < 18) {
		// TODO - Enable `CF-IPCountry` in Cloudflare and only use IP2Location as a fallback
		const location = IP2LocationManager.lookup(clientIP);
		if (location?.country === 'US' && location?.region === 'Mississippi') {
			// * See https://bsky.social/about/blog/08-22-2025-mississippi-hb1126 for details
			response.status(403).json({
				app: 'api',
				status: 403,
				error: 'Mississippi law prevents us from collecting any data from any users under the age of 18 without extreme parental verification methods.' // TODO - Expand on this and translate it? this will be shown on the website
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
			device_type: 'wiiu'
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
		if (error.stack) {
			console.error(error.stack);
		}

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

	try {
		const accessToken = await OAuthToken.create({
			token: crypto.randomBytes(16).toString('hex'),
			client_id: 'a2efa818a34fa16b8afbc8a74eba3eda', // TODO - This is the Wii U config, change this?
			client_secret: 'c91cdb5658bd4954ade78533a339cf9a', // TODO - This is the Wii U config, change this?
			pid: pnid.pid,
			info: {
				system_type: SystemType.API,
				token_type: TokenType.OAuthAccess,
				title_id: BigInt(0),
				issued: new Date(),
				expires: new Date(Date.now() + (3600 * 1000))
			}
		});

		const refreshToken = await OAuthToken.create({
			token: crypto.randomBytes(20).toString('hex'),
			client_id: 'a2efa818a34fa16b8afbc8a74eba3eda', // TODO - This is the Wii U config, change this?
			client_secret: 'c91cdb5658bd4954ade78533a339cf9a', // TODO - This is the Wii U config, change this?
			pid: pnid.pid,
			info: {
				system_type: SystemType.API,
				token_type: TokenType.OAuthRefresh,
				title_id: BigInt(0),
				issued: new Date(),
				expires: new Date(Date.now() + 12 * 3600 * 1000)
			}
		});

		response.json({
			access_token: accessToken,
			token_type: 'Bearer',
			expires_in: 3600,
			refresh_token: refreshToken
		});
	} catch (error: any) {
		LOG_ERROR('/v1/register - token generation: ' + error);
		if (error.stack) {
			console.error(error.stack);
		}

		response.status(500).json({
			app: 'api',
			status: 500,
			error: 'Internal server error'
		});
	}
});

export default router;
