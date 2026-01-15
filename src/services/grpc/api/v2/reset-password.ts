import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { Status, ServerError } from 'nice-grpc';
import { PasswordResetToken } from '@/models/password_reset_token';
import { nintendoPasswordHash } from '@/util';
import { getPNIDByPID } from '@/database';
import { SystemType } from '@/types/common/system-types';
import { TokenType } from '@/types/common/token-types';
import type { ResetPasswordRequest, ResetPasswordResponse } from '@pretendonetwork/grpc/api/v2/reset_password_rpc';
import type { HydratedPNIDDocument } from '@/types/mongoose/pnid';

// * This sucks
const PASSWORD_WORD_OR_NUMBER_REGEX = /(?=.*[a-zA-Z])(?=.*\d).*/;
const PASSWORD_WORD_OR_PUNCTUATION_REGEX = /(?=.*[a-zA-Z])(?=.*[_\-.]).*/;
const PASSWORD_NUMBER_OR_PUNCTUATION_REGEX = /(?=.*\d)(?=.*[_\-.]).*/;
const PASSWORD_REPEATED_CHARACTER_REGEX = /(.)\1\1/;

export async function resetPassword(request: ResetPasswordRequest): Promise<ResetPasswordResponse> {
	const password = request.password.trim();
	const passwordConfirm = request.passwordConfirm.trim();
	const token = request.token.trim();

	if (!token) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Missing token');
	}

	let pnid: HydratedPNIDDocument | null = null;
	try {
		const passwordResetToken = await PasswordResetToken.findOne({
			token: crypto.createHash('sha256').update(token).digest('hex')
		});

		if (!passwordResetToken) {
			throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid token');
		}

		if (passwordResetToken.info.system_type !== SystemType.PasswordReset) {
			throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid token');
		}

		if (passwordResetToken.info.token_type !== TokenType.PasswordReset) {
			throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid token');
		}

		if (passwordResetToken.info.expires < new Date()) {
			throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid token');
		}

		pnid = await getPNIDByPID(passwordResetToken.pid);
	} catch {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid token');
	}

	if (!pnid) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid token. No user found');
	}

	if (!password) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Must enter a password');
	}

	if (password.length < 6) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Password is too short');
	}

	if (password.length > 16) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Password is too long');
	}

	if (password.toLowerCase() === pnid.usernameLower) {
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

	const primaryPasswordHash = nintendoPasswordHash(password, pnid.pid);
	const passwordHash = await bcrypt.hash(primaryPasswordHash, 10);

	pnid.password = passwordHash;

	await pnid.save();

	return {};
}
