import crypto from 'node:crypto';
import validator from 'validator';
import { ServerError, Status } from 'nice-grpc';
import { sendConfirmationEmail } from '@/util';
import type { CallContext } from 'nice-grpc';
import type {
	UpdateEmailRequest,
	UpdateEmailResponse
} from '@pretendonetwork/grpc/api/v2/update_email_rpc';
import type { AuthenticationCallContextExt } from '@/services/grpc/api/v1/authentication-middleware';

export async function updateEmail(
	request: UpdateEmailRequest,
	context: CallContext & AuthenticationCallContextExt
): Promise<UpdateEmailResponse> {
	// * This is asserted in authentication-middleware, we know this is never null
	const pnid = context.pnid!;

	const newEmail = request.email?.trim().toLowerCase();

	if (!newEmail) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Must provide new email address');
	}

	if (!validator.isEmail(newEmail)) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid email address');
	}

	/* We allow the new email to equal the old email, and treat this as a verification email resend request

	if (newEmail === pnid.email.address) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'New email address must differ from current');
	}
	*/

	const emailUpdateEvent = { old: pnid.email.address, new: newEmail, on: new Date() };
	pnid.email.history.unshift(emailUpdateEvent);

	pnid.email.address = newEmail;
	pnid.email.reachable = false;
	pnid.email.validated = false;
	pnid.email.validated_date = '';
	pnid.email.id = crypto.randomBytes(4).readUInt32LE();

	await pnid.generateEmailValidationCode();
	await pnid.generateEmailValidationToken();
	await sendConfirmationEmail(pnid);

	await pnid.save();

	return {};
}
