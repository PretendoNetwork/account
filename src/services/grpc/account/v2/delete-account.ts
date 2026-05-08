import { Status, ServerError } from 'nice-grpc';
import { getPNIDByPID } from '@/database';
import { sendPNIDDeletedEmail } from '@/util';
import { LOG_ERROR, LOG_INFO } from '@/logger';
import type { DeleteAccountRequest, DeleteAccountResponse } from '@pretendonetwork/grpc/account/v2/delete_account_rpc';

export async function deleteAccount(request: DeleteAccountRequest): Promise<DeleteAccountResponse> {
	const pnid = await getPNIDByPID(request.pid);

	if (!pnid) {
		throw new ServerError(
			Status.INVALID_ARGUMENT,
			'No PNID found'
		);
	}

	try {
		LOG_INFO(`Deleting PNID ${pnid.pid} (bypass grace period=${request.bypassGracePeriod})`);
		const email = pnid.email.address;

		if (request.bypassGracePeriod) {
			await pnid.scrub();
		} else {
			await pnid.markForDeletion();
		}

		await pnid.save();

		await sendPNIDDeletedEmail(email, pnid.username);

		if (request.bypassGracePeriod) {
			LOG_INFO(`PNID ${pnid.pid} deleted immediately (bypassed grace period)`);
		} else {
			LOG_INFO(`PNID ${pnid.pid} marked for deletion (will be deleted after grace period)`);
		}
	} catch (error) {
		LOG_ERROR(`Error deleting PNID ${pnid.pid}: ${error}`);
	}

	return {
		hasDeleted: pnid.deleted || pnid.marked_for_deletion
	};
}
