import { Status, ServerError } from 'nice-grpc';
import { AuditLogActionType } from '@pretendonetwork/grpc/account/v2/audit_log_action_type';
import { getPNIDByPID } from '@/database';
import { LOG_ERROR, LOG_INFO } from '@/logger';
import { AuditLog } from '@/models/audit-log';
import { getExecutorPNID } from '@/services/grpc/account/v2/utils';
import { sendPNIDDeletedEmail } from '@/util';
import { PNID_PERMISSION_FLAGS } from '@/types/common/permission-flags';
import type { CallContext } from 'nice-grpc';
import type { DeletePNIDRequest, DeletePNIDResponse } from '@pretendonetwork/grpc/account/v2/delete_pnid_rpc';

export async function deletePNID(request: DeletePNIDRequest, context: CallContext): Promise<DeletePNIDResponse> {
	const executor = await getExecutorPNID(context, PNID_PERMISSION_FLAGS.MODIFY_PNIDS); // TODO - Should this be its own permission?

	if (request.pid === 0) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid PNID PID');
	}

	const pnid = await getPNIDByPID(request.pid);

	if (!pnid) {
		throw new ServerError(Status.NOT_FOUND, 'PNID not found');
	}

	if (pnid.deleted || pnid.marked_for_deletion) {
		throw new ServerError(Status.FAILED_PRECONDITION, 'PNID has already been deleted');
	}

	try {
		await pnid.markForDeletion();

		await AuditLog.create({
			action_type: AuditLogActionType.AUDIT_LOG_ACTION_TYPE_DELETE_NETWORK_ACCOUNT,
			executed_by_pid: executor.pid,
			metadata: JSON.stringify({
				pid: pnid.pid,
				username: pnid.username,
				hard_delete_time: pnid.hard_delete_time
			})
		});
	} catch (error) {
		LOG_ERROR(`[gRPC] /account.v2.AccountService/DeletePNID: ${error instanceof Error ? error.message : error}`);

		throw new ServerError(Status.INTERNAL, 'Failed to delete PNID');
	}

	LOG_INFO(`PNID ${pnid.pid} marked for deletion by PNID ${executor.pid} (will be deleted after grace period)`);

	try {
		await sendPNIDDeletedEmail(pnid.email.address, pnid.username);
	} catch (error) {
		LOG_ERROR(`[gRPC] /account.v2.AccountService/DeletePNID: Failed to send deletion email to PNID ${pnid.pid}: ${error instanceof Error ? error.message : error}`);
	}

	return {};
}
