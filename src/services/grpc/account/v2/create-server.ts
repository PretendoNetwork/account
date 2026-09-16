import { Status, ServerError } from 'nice-grpc';
import { AuditLogActionType } from '@pretendonetwork/grpc/account/v2/audit_log_action_type';
import { connection as databaseConnection } from '@/database';
import { LOG_ERROR } from '@/logger';
import { AuditLog } from '@/models/audit-log';
import { Server } from '@/models/server';
import { getExecutorPNID } from '@/services/grpc/account/v2/utils';
import { PNID_PERMISSION_FLAGS } from '@/types/common/permission-flags';
import { SystemType } from '@/types/common/system-types';
import type { CallContext } from 'nice-grpc';
import type { CreateServerRequest, CreateServerResponse } from '@pretendonetwork/grpc/account/v2/create_server_rpc';
import type { HydratedServerDocument } from '@/types/mongoose/server';

const ACCESS_MODES = [
	'prod',
	'test',
	'dev'
];
const DEVICES = [
	SystemType.WUP, SystemType.CTR
];

export async function createServer(request: CreateServerRequest, context: CallContext): Promise<CreateServerResponse> {
	const executor = await getExecutorPNID(context, PNID_PERMISSION_FLAGS.CREATE_SERVER_CONFIGS);

	const ip = request.ip.trim();
	const serviceName = request.serviceName.trim();
	const serviceType = request.serviceType.trim();
	const gameServerID = request.gameServerId.trim();
	const titleIDs = request.titleIds.map(titleID => titleID.trim());
	const aesKey = request.aesKey.trim();
	const clientID = request.clientId?.trim() || undefined;

	if (ip.length === 0) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Server IP cannot be empty');
	}

	if (!Number.isInteger(request.port) || request.port < 0 || request.port > 65535) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Server port must be between 0 and 65535');
	}

	if (serviceName.length === 0) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Service name cannot be empty');
	}

	if (serviceType.length === 0) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Service type cannot be empty');
	}

	if (gameServerID.length === 0) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Game server ID cannot be empty');
	}

	if (titleIDs.some(titleID => titleID.length === 0)) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Title IDs cannot be empty');
	}

	if (!ACCESS_MODES.includes(request.accessMode)) {
		throw new ServerError(Status.INVALID_ARGUMENT, `Access mode must be one of ${ACCESS_MODES.join(', ')}`);
	}

	if (!DEVICES.includes(request.device)) {
		throw new ServerError(Status.INVALID_ARGUMENT, `Device must be one of ${DEVICES.join(', ')}`);
	}

	if (aesKey.length === 0) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'AES key cannot be empty');
	}

	const session = await databaseConnection().startSession();
	let server: HydratedServerDocument;

	try {
		session.startTransaction();

		server = new Server({
			client_id: clientID,
			ip: ip,
			port: request.port,
			service_name: serviceName,
			service_type: serviceType,
			game_server_id: gameServerID,
			title_ids: titleIDs,
			access_mode: request.accessMode,
			maintenance_mode: request.maintenanceMode,
			device: request.device,
			aes_key: aesKey
		});

		await server.save({
			session
		});

		// * The AES key is intentionally left out of the audit log
		await new AuditLog({
			action_type: AuditLogActionType.AUDIT_LOG_ACTION_TYPE_CREATE_SERVER,
			executed_by_pid: executor.pid,
			metadata: JSON.stringify({
				server_id: server._id.toString(),
				client_id: clientID,
				ip: ip,
				port: request.port,
				service_name: serviceName,
				service_type: serviceType,
				game_server_id: gameServerID,
				title_ids: titleIDs,
				access_mode: request.accessMode,
				maintenance_mode: request.maintenanceMode,
				device: request.device
			})
		}).save({
			session
		});

		await session.commitTransaction();
	} catch (error) {
		await session.abortTransaction();

		LOG_ERROR(`[gRPC] /account.v2.AccountService/CreateServer: ${error instanceof Error ? error.message : error}`);

		throw new ServerError(Status.INTERNAL, 'Failed to create server');
	} finally {
		await session.endSession();
	}

	return {
		item: {
			id: server._id.toString(),
			ip: server.ip ?? server.ip_list?.[0] ?? '',
			port: server.port,
			serviceName: server.service_name,
			serviceType: server.service_type,
			gameServerId: server.game_server_id,
			titleIds: server.title_ids,
			accessMode: server.access_mode,
			maintenanceMode: server.maintenance_mode,
			device: server.device,
			aesKey: server.aes_key,
			clientId: server.client_id || undefined
		}
	};
}
