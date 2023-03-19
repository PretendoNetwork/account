import express from 'express';
import bcrypt from 'bcrypt';
import { PNID } from '@/models/pnid';
import { decryptToken, unpackToken, nintendoPasswordHash } from '@/util';
import { Token } from '@/types/common/token';
import { HydratedPNIDDocument } from '@/types/mongoose/pnid';

const router: express.Router = express.Router();

// This sucks
const PASSWORD_WORD_OR_NUMBER_REGEX: RegExp = /(?=.*[a-zA-Z])(?=.*\d).*/;
const PASSWORD_WORD_OR_PUNCTUATION_REGEX: RegExp = /(?=.*[a-zA-Z])(?=.*[_\-.]).*/;
const PASSWORD_NUMBER_OR_PUNCTUATION_REGEX: RegExp = /(?=.*\d)(?=.*[_\-.]).*/;
const PASSWORD_REPEATED_CHARACTER_REGEX: RegExp = /(.)\1\1/;

router.post('/', async (request: express.Request, response: express.Response) => {
	const password: string = request.body.password?.trim();
	const passwordConfirm: string = request.body.password_confirm?.trim();
	const token: string = request.body.token?.trim();

	if (!token || token === '') {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Missing token'
		});
	}

	let unpackedToken: Token;
	try {
		const decryptedToken: Buffer = await decryptToken(Buffer.from(token, 'base64'));
		unpackedToken = unpackToken(decryptedToken);
	} catch (error) {
		console.log(error);
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid token'
		});
	}

	if (unpackedToken.expire_time < Date.now()) {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Token expired'
		});
	}

	const pnid: HydratedPNIDDocument | null = await PNID.findOne({ pid: unpackedToken.pid });

	if (!pnid) {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid token. No user found'
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

	if (password.toLowerCase() === pnid.usernameLower) {
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

	const primaryPasswordHash: string = nintendoPasswordHash(password, pnid.pid);
	const passwordHash: string = await bcrypt.hash(primaryPasswordHash, 10);

	pnid.password = passwordHash;

	await pnid.save();

	response.json({
		app: 'api',
		status: 200
	});
});

export default router;