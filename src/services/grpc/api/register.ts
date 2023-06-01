import crypto from 'node:crypto';
import { Status, ServerError } from 'nice-grpc';
import { RegisterRequest, DeepPartial } from 'pretendo-grpc-ts/dist/api/register_rpc';
import { LoginResponse } from 'pretendo-grpc-ts/dist/api/login_rpc';
import emailvalidator from 'email-validator';
import bcrypt from 'bcrypt';
import moment from 'moment';
import hcaptcha from 'hcaptcha';
import Mii from 'mii-js';
import mongoose from 'mongoose';
import { doesPNIDExist, connection as databaseConnection } from '@/database';
import { nintendoPasswordHash, sendConfirmationEmail, generateToken } from '@/util';
import { LOG_ERROR } from '@/logger';
import { PNID } from '@/models/pnid';
import { NEXAccount } from '@/models/nex-account';
import { config, disabledFeatures } from '@/config-manager';
import type { TokenOptions } from '@/types/common/token-options';
import type { HydratedNEXAccountDocument } from '@/types/mongoose/nex-account';
import type { HydratedPNIDDocument } from '@/types/mongoose/pnid';

const PNID_VALID_CHARACTERS_REGEX: RegExp = /^[\w\-.]*$/;
const PNID_PUNCTUATION_START_REGEX: RegExp = /^[_\-.]/;
const PNID_PUNCTUATION_END_REGEX: RegExp = /[_\-.]$/;
const PNID_PUNCTUATION_DUPLICATE_REGEX: RegExp = /[_\-.]{2,}/;

// This sucks
const PASSWORD_WORD_OR_NUMBER_REGEX: RegExp = /(?=.*[a-zA-Z])(?=.*\d).*/;
const PASSWORD_WORD_OR_PUNCTUATION_REGEX: RegExp = /(?=.*[a-zA-Z])(?=.*[_\-.]).*/;
const PASSWORD_NUMBER_OR_PUNCTUATION_REGEX: RegExp = /(?=.*\d)(?=.*[_\-.]).*/;
const PASSWORD_REPEATED_CHARACTER_REGEX: RegExp = /(.)\1\1/;

const DEFAULT_MII_DATA: Buffer = Buffer.from('AwAAQOlVognnx0GC2/uogAOzuI0n2QAAAEBEAGUAZgBhAHUAbAB0AAAAAAAAAEBAAAAhAQJoRBgmNEYUgRIXaA0AACkAUkhQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGm9', 'base64');

export async function register(request: RegisterRequest): Promise<DeepPartial<LoginResponse>> {
	const email: string = request.email?.trim();
	const username: string = request.username?.trim();
	const miiName: string = request.miiName?.trim();
	const password: string = request.password?.trim();
	const passwordConfirm: string = request.passwordConfirm?.trim();
	const captchaResponse: string | undefined = request.captchaResponse?.trim();

	// * Only validate the captcha if that's enabled
	if (!disabledFeatures.captcha) {
		if (!captchaResponse) {
			throw new ServerError(Status.INVALID_ARGUMENT, 'Must fill in captcha');
		}

		const captchaVerify: VerifyResponse = await hcaptcha.verify(config.hcaptcha.secret, captchaResponse);

		if (!captchaVerify.success) {
			throw new ServerError(Status.INVALID_ARGUMENT, 'Captcha verification failed');
		}
	}

	if (!email) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Must enter an email address');
	}

	if (!emailvalidator.validate(email)) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid email address');
	}

	if (!username) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Must enter a username');
	}

	if (username.length < 6) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Username is too short');
	}

	if (username.length > 16) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Username is too long');
	}

	if (!PNID_VALID_CHARACTERS_REGEX.test(username)) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Username contains invalid characters');
	}

	if (PNID_PUNCTUATION_START_REGEX.test(username)) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Username cannot begin with punctuation characters');
	}

	if (PNID_PUNCTUATION_END_REGEX.test(username)) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Username cannot end with punctuation characters');
	}

	if (PNID_PUNCTUATION_DUPLICATE_REGEX.test(username)) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Two or more punctuation characters cannot be used in a row');
	}

	const userExists: boolean = await doesPNIDExist(username);

	if (userExists) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'PNID already in use');
	}

	if (!miiName) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Must enter a Mii name');
	}

	const miiNameBuffer: Buffer = Buffer.from(miiName, 'utf16le'); // * UTF8 to UTF16

	if (miiNameBuffer.length > 0x14) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Mii name too long');
	}

	if (!password) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Must enter a password');
	}

	if (password.length < 6 || password.length > 16) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Password must be between 6 and 16 characters long');
	}

	if (password.toLowerCase() === username.toLowerCase()) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Password cannot be the same as username');
	}

	if (!PASSWORD_WORD_OR_NUMBER_REGEX.test(password) && !PASSWORD_WORD_OR_PUNCTUATION_REGEX.test(password) && !PASSWORD_NUMBER_OR_PUNCTUATION_REGEX.test(password)) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Password must have combination of letters, numbers, and/or punctuation characters');
	}

	if (PASSWORD_REPEATED_CHARACTER_REGEX.test(password)) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Password may not have 3 repeating characters');
	}

	if (password !== passwordConfirm) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Passwords do not match');
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
		nexAccount.owning_pid = nexAccount.pid;

		await nexAccount.save({ session });

		const primaryPasswordHash: string = nintendoPasswordHash(password, nexAccount.pid);
		const passwordHash: string = await bcrypt.hash(primaryPasswordHash, 10);

		pnid = new PNID({
			pid: nexAccount.pid,
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
		let message: string = 'Unknown Mongo error';

		if (error instanceof Error) {
			message = error.message;
		}

		LOG_ERROR(`[gRPC] /api.API/Register: ${message}`);

		await session.abortTransaction();

		throw new ServerError(Status.INVALID_ARGUMENT, message);
	} finally {
		// * This runs regardless of failure
		// * Returning on catch will not prevent this from running
		await session.endSession();
	}

	await sendConfirmationEmail(pnid);

	const accessTokenOptions: TokenOptions = {
		system_type: 0x3, // * API
		token_type: 0x1, // * OAuth Access
		pid: pnid.pid,
		access_level: pnid.access_level,
		title_id: BigInt(0),
		expire_time: BigInt(Date.now() + (3600 * 1000))
	};

	const refreshTokenOptions: TokenOptions = {
		system_type: 0x3, // * API
		token_type: 0x2, // * OAuth Refresh
		pid: pnid.pid,
		access_level: pnid.access_level,
		title_id: BigInt(0),
		expire_time: BigInt(Date.now() + (3600 * 1000))
	};

	const accessTokenBuffer: Buffer | null = await generateToken(config.aes_key, accessTokenOptions);
	const refreshTokenBuffer: Buffer | null = await generateToken(config.aes_key, refreshTokenOptions);

	const accessToken: string = accessTokenBuffer ? accessTokenBuffer.toString('hex') : '';
	const refreshToken: string = refreshTokenBuffer ? refreshTokenBuffer.toString('hex') : '';

	// TODO - Handle null tokens

	return {
		accessToken: accessToken,
		tokenType: 'Bearer',
		expiresIn: 3600,
		refreshToken: refreshToken
	};
}