import bcrypt from 'bcrypt';
import { Status, ServerError } from 'nice-grpc';
import { nintendoPasswordHash, sendPasswordResetNoticeEmail } from '@/util';
import type { CallContext } from 'nice-grpc';
import type { UpdatePasswordRequest, UpdatePasswordResponse } from '@pretendonetwork/grpc/api/v2/update_password_rpc';
import type { AuthenticationCallContextExt } from '@/services/grpc/api/v2/authentication-middleware';

// * This sucks
const PASSWORD_WORD_OR_NUMBER_REGEX = /(?=.*[a-zA-Z])(?=.*\d).*/;
const PASSWORD_WORD_OR_PUNCTUATION_REGEX = /(?=.*[a-zA-Z])(?=.*[_\-.]).*/;
const PASSWORD_NUMBER_OR_PUNCTUATION_REGEX = /(?=.*\d)(?=.*[_\-.]).*/;
const PASSWORD_REPEATED_CHARACTER_REGEX = /(.)\1\1/;

export async function updatePassword(request: UpdatePasswordRequest,
	context: CallContext & AuthenticationCallContextExt
): Promise<UpdatePasswordResponse> {
	// * This is asserted in authentication-middleware, we know this is never null
	const pnid = context.pnid!;

	const oldPassword = request.oldPassword.trim();
	const newPassword = request.newPassword.trim();
	const newPasswordConfirm = request.newPasswordConfirm.trim();

	const hashedOldPassword = nintendoPasswordHash(oldPassword!, pnid.pid); // * We know password will never be null here

	if (!bcrypt.compareSync(hashedOldPassword, pnid.password)) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Password is incorrect');
	}

	if (!newPassword) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Must enter a new password');
	}

	if (newPassword !== newPasswordConfirm) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Passwords do not match');
	}

	if (newPassword === oldPassword) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'New password must not equal current password');
	}

	if (newPassword.length < 6 || newPassword.length > 16) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Password must be between 6 and 16 characters long');
	}

	if (newPassword.toLowerCase() === pnid.username.toLowerCase()) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Password cannot be the same as username');
	}

	if (!PASSWORD_WORD_OR_NUMBER_REGEX.test(newPassword) && !PASSWORD_WORD_OR_PUNCTUATION_REGEX.test(newPassword) && !PASSWORD_NUMBER_OR_PUNCTUATION_REGEX.test(newPassword)) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Password must have combination of letters, numbers, and/or punctuation characters');
	}

	if (PASSWORD_REPEATED_CHARACTER_REGEX.test(newPassword)) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Password may not have 3 repeating characters');
	}

	const primaryPasswordHash = nintendoPasswordHash(newPassword, pnid.pid);
	const passwordHash = await bcrypt.hash(primaryPasswordHash, 10);

	pnid.password = passwordHash;

	await pnid.removeAllTokens();
	await pnid.save();

	await sendPasswordResetNoticeEmail(pnid);

	return {};
}
