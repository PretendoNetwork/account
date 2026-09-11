import moment from 'moment';
import { ServerError, Status } from 'nice-grpc';
import { sendEmailConfirmedEmail } from '@/util';
import { PNID } from '@/models/pnid';
import type {
	VerifyEmailRequest,
	VerifyEmailResponse
} from '@pretendonetwork/grpc/api/v2/verify_email_rpc';

export async function verifyEmail(
	request: VerifyEmailRequest
): Promise<VerifyEmailResponse> {
	const token = request?.token?.trim();

	if (!token) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Missing email token');
	}

	const pnid = await PNID.findOne({
		'identification.email_token': token
	});

	if (!pnid) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid email token');
	}

	if (!pnid.email.validated) {
		const validatedDate = moment().format('YYYY-MM-DDTHH:MM:SS');

		pnid.email.reachable = true;
		pnid.email.validated = true;
		pnid.email.validated_date = validatedDate;

		await pnid.save();
		await sendEmailConfirmedEmail(pnid);
	}

	return {};
}
