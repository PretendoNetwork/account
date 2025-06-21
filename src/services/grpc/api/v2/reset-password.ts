import bcrypt from 'bcrypt';
import { Status, ServerError } from 'nice-grpc';
import { decryptToken, unpackToken, nintendoPasswordHash } from '@/util';
import { getPNIDByPID } from '@/database';
import type { ResetPasswordRequest, ResetPasswordResponse } from '@pretendonetwork/grpc/api/v2/reset_password_rpc';
import type { Token } from '@/types/common/token';

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

	let unpackedToken: Token;
	try {
		const decryptedToken = await decryptToken(Buffer.from(token, 'base64'));
		unpackedToken = unpackToken(decryptedToken);
	} catch {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid token');
	}

	if (unpackedToken.expire_time < Date.now()) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Token expired');
	}

	const pnid = await getPNIDByPID(unpackedToken.pid);

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
