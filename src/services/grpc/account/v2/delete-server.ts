import { Status, ServerError } from 'nice-grpc';
import { isValidObjectId } from 'mongoose';
import { AuditLogActionType } from '@pretendonetwork/grpc/account/v2/audit_log_action_type';
import { connection as databaseConnection } from '@/database';
import { LOG_ERROR } from '@/logger';
import { AuditLog } from '@/models/audit-log';
import { Server } from '@/models/server';
import { getExecutorPNID } from '@/services/grpc/account/v2/utils';
import { PNID_PERMISSION_FLAGS } from '@/types/common/permission-flags';
import type { CallContext } from 'nice-grpc';
import type { DeleteServerRequest, DeleteServerResponse } from '@pretendonetwork/grpc/account/v2/delete_server_rpc';

export async function deleteServer(request: DeleteServerRequest, context: CallContext): Promise<DeleteServerResponse> {
	const executor = await getExecutorPNID(context, PNID_PERMISSION_FLAGS.MODIFY_SERVER_CONFIGS); // TODO - Should this be a different permission?

	if (!isValidObjectId(request.id)) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid server ID');
	}

	const session = await databaseConnection().startSession();

	try {
		session.startTransaction();

		const server = await Server.findByIdAndDelete(request.id).session(session);

		if (!server) {
			throw new ServerError(Status.NOT_FOUND, 'Server not found');
		}

		// * Dump the old server into the log in case we need to restore it.
		// * The AES key is intentionally left out of the audit log
		await new AuditLog({
			action_type: AuditLogActionType.AUDIT_LOG_ACTION_TYPE_DELETE_SERVER,
			executed_by_pid: executor.pid,
			metadata: JSON.stringify({
				server_id: server._id.toString(),
				client_id: server.client_id || null,
				ip: server.ip ?? null,
				ip_list: server.ip_list ?? [],
				port: server.port,
				service_name: server.service_name,
				service_type: server.service_type,
				game_server_id: server.game_server_id,
				title_ids: server.title_ids,
				access_mode: server.access_mode,
				maintenance_mode: server.maintenance_mode,
				device: server.device,
				health_check_port: server.health_check_port ?? null
			})
		}).save({
			session
		});

		await session.commitTransaction();
	} catch (error) {
		await session.abortTransaction();

		if (error instanceof ServerError) {
			throw error;
		}

		LOG_ERROR(`[gRPC] /account.v2.AccountService/DeleteServer: ${error instanceof Error ? error.message : error}`);

		throw new ServerError(Status.INTERNAL, 'Failed to delete server');
	} finally {
		await session.endSession();
	}

	return {};
}
