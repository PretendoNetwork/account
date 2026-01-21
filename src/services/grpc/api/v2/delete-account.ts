import { Status, ServerError } from 'nice-grpc';
import { getPNIDByPID } from '@/database';
import { sendPNIDDeletedEmail } from '@/util';
import { LOG_ERROR } from '@/logger';
import type { DeleteAccountRequest, DeleteAccountResponse } from '@pretendonetwork/grpc/api/v2/delete_account_rpc';

export async function deleteAccount(request: DeleteAccountRequest): Promise<DeleteAccountResponse> {
	const pnid = await getPNIDByPID(request.pid);

	if (!pnid) {
		throw new ServerError(
			Status.INVALID_ARGUMENT,
			'No PNID found'
		);
	}

	try {
		const email = pnid.email.address;

		pnid.markForDeletion();
		await pnid.save();

		await sendPNIDDeletedEmail(email, pnid.username);
	} catch (error) {
		LOG_ERROR(`Deleting PNID ${error}`);
	}

	return {
		hasDeleted: pnid.deleted || pnid.marked_for_deletion
	};
}
