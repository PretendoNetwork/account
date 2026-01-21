import crypto from 'node:crypto';
import express from 'express';
import bcrypt from 'bcrypt';
import { PasswordResetToken } from '@/models/password-reset-token';
import { nintendoPasswordHash } from '@/util';
import { SystemType } from '@/types/common/system-types';
import { TokenType } from '@/types/common/token-types';
import { getPNIDByPID } from '@/database';
import type { HydratedPNIDDocument } from '@/types/mongoose/pnid';

const router = express.Router();

// * This sucks
const PASSWORD_WORD_OR_NUMBER_REGEX = /(?=.*[a-zA-Z])(?=.*\d).*/;
const PASSWORD_WORD_OR_PUNCTUATION_REGEX = /(?=.*[a-zA-Z])(?=.*[_\-.]).*/;
const PASSWORD_NUMBER_OR_PUNCTUATION_REGEX = /(?=.*\d)(?=.*[_\-.]).*/;
const PASSWORD_REPEATED_CHARACTER_REGEX = /(.)\1\1/;

router.post('/', async (request: express.Request, response: express.Response): Promise<void> => {
	const password = request.body.password?.trim();
	const passwordConfirm = request.body.password_confirm?.trim();
	const token = request.body.token?.trim();

	if (!token || token === '') {
		response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Missing token'
		});

		return;
	}

	let pnid: HydratedPNIDDocument | null = null;
	try {
		const passwordResetToken = await PasswordResetToken.findOne({
			token: crypto.createHash('sha256').update(token).digest('hex')
		});

		if (!passwordResetToken) {
			response.status(400).json({
				app: 'api',
				status: 400,
				error: 'Invalid token'
			});

			return;
		}

		if (passwordResetToken.info.system_type !== SystemType.PasswordReset) {
			response.status(400).json({
				app: 'api',
				status: 400,
				error: 'Invalid token'
			});

			return;
		}

		if (passwordResetToken.info.token_type !== TokenType.PasswordReset) {
			response.status(400).json({
				app: 'api',
				status: 400,
				error: 'Invalid token'
			});

			return;
		}

		if (passwordResetToken.info.expires < new Date()) {
			response.status(400).json({
				app: 'api',
				status: 400,
				error: 'Token expired'
			});

			return;
		}

		pnid = await getPNIDByPID(passwordResetToken.pid);
	} catch {
		response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid token'
		});

		return;
	}

	if (!pnid) {
		response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid token. No user found'
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

	if (password.toLowerCase() === pnid.usernameLower) {
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

	const primaryPasswordHash = nintendoPasswordHash(password, pnid.pid);
	const passwordHash = await bcrypt.hash(primaryPasswordHash, 10);

	pnid.password = passwordHash;

	await pnid.save();

	response.json({
		app: 'api',
		status: 200
	});
});

export default router;
