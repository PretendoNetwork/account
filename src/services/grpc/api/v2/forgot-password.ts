import { Status, ServerError } from 'nice-grpc';
import validator from 'validator';
import { getPNIDByEmailAddress, getPNIDByUsername } from '@/database';
import { sendForgotPasswordEmail } from '@/util';
import type { ForgotPasswordRequest } from '@pretendonetwork/grpc/api/v2/forgot_password_rpc';
import type { Empty } from '@pretendonetwork/grpc/google/protobuf/empty';
import type { HydratedPNIDDocument } from '@/types/mongoose/pnid';

export async function forgotPassword(request: ForgotPasswordRequest): Promise<Empty> {
	const input = request.emailAddressOrUsername.trim();

	if (!input) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid or missing input');
	}

	let pnid: HydratedPNIDDocument | null;

	if (validator.isEmail(input)) {
		pnid = await getPNIDByEmailAddress(input);
	} else {
		pnid = await getPNIDByUsername(input);
	}

	if (pnid) {
		await sendForgotPasswordEmail(pnid);
	}

	return {};
}
