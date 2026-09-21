import { Status, ServerError } from 'nice-grpc';
import { isValidObjectId } from 'mongoose';
import { AuditLogActionType } from '@pretendonetwork/grpc/account/v2/audit_log_action_type';
import { connection as databaseConnection } from '@/database';
import { LOG_ERROR } from '@/logger';
import { AuditLog } from '@/models/audit-log';
import { Server } from '@/models/server';
import { getExecutorPNID } from '@/services/grpc/account/v2/utils';
import { PNID_PERMISSION_FLAGS } from '@/types/common/permission-flags';
import { SystemType } from '@/types/common/system-types';
import type { CallContext } from 'nice-grpc';
import type { UpdateServerRequest, UpdateServerResponse } from '@pretendonetwork/grpc/account/v2/update_server_rpc';
import type { HydratedServerDocument } from '@/types/mongoose/server';

const ACCESS_MODES = [
	'prod',
	'test',
	'dev'
];
const DEVICES = [
	SystemType.WUP,
	SystemType.CTR
];

export async function updateServer(request: UpdateServerRequest, context: CallContext): Promise<UpdateServerResponse> {
	const executor = await getExecutorPNID(context, PNID_PERMISSION_FLAGS.MODIFY_SERVER_CONFIGS);

	if (!isValidObjectId(request.id)) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid server ID');
	}

	const ip = request.ip?.trim();
	const port = request.port;
	const serviceName = request.serviceName?.trim();
	const serviceType = request.serviceType?.trim();
	const gameServerID = request.gameServerId?.trim();
	const titleIDs = request.titleIds;
	const accessMode = request.accessMode?.trim();
	const maintenanceMode = request.maintenanceMode;
	const device = request.device;
	const aesKey = request.aesKey?.trim();
	const clientID = request.clientId;

	const session = await databaseConnection().startSession();
	let server: HydratedServerDocument | null;

	try {
		session.startTransaction();

		server = await Server.findById(request.id).session(session);

		if (!server) {
			throw new ServerError(Status.NOT_FOUND, 'Server not found');
		}

		const oldServer = server.toObject();

		if (ip !== undefined) {
			if (ip.length === 0) {
				throw new ServerError(Status.INVALID_ARGUMENT, 'Server IP cannot be empty');
			}

			server.ip = ip;
		}

		if (port !== undefined) {
			if (!Number.isInteger(port) || port < 0 || port > 65535) {
				throw new ServerError(Status.INVALID_ARGUMENT, 'Server port must be between 0 and 65535');
			}

			server.port = port;
		}

		if (serviceName !== undefined) {
			if (serviceName.length === 0) {
				throw new ServerError(Status.INVALID_ARGUMENT, 'Service name cannot be empty');
			}

			server.service_name = serviceName;
		}

		if (serviceType !== undefined) {
			if (serviceType.length === 0) {
				throw new ServerError(Status.INVALID_ARGUMENT, 'Service type cannot be empty');
			}

			server.service_type = serviceType;
		}

		if (gameServerID !== undefined) {
			if (gameServerID.length === 0) {
				throw new ServerError(Status.INVALID_ARGUMENT, 'Game server ID cannot be empty');
			}

			server.game_server_id = gameServerID;
		}

		if (titleIDs !== undefined) {
			const titleIDsToAdd = titleIDs.add.map(titleID => titleID.trim());
			const titleIDsToRemove = titleIDs.remove.map(titleID => titleID.trim());

			if (titleIDsToAdd.some(titleID => titleID.length === 0)) {
				throw new ServerError(Status.INVALID_ARGUMENT, 'Title IDs cannot be empty');
			}

			server.title_ids = [
				...new Set([
					...server.title_ids.filter(titleID => !titleIDsToRemove.includes(titleID)),
					...titleIDsToAdd
				])
			];
		}

		if (accessMode !== undefined) {
			if (!ACCESS_MODES.includes(accessMode)) {
				throw new ServerError(Status.INVALID_ARGUMENT, `Access mode must be one of ${ACCESS_MODES.join(', ')}`);
			}

			server.access_mode = accessMode;
		}

		if (maintenanceMode !== undefined) {
			server.maintenance_mode = maintenanceMode;
		}

		if (device !== undefined) {
			if (!DEVICES.includes(device)) {
				throw new ServerError(Status.INVALID_ARGUMENT, `Device must be one of ${DEVICES.join(', ')}`);
			}

			server.device = device;
		}

		if (aesKey !== undefined) {
			if (aesKey.length === 0) {
				throw new ServerError(Status.INVALID_ARGUMENT, 'AES key cannot be empty');
			}

			server.aes_key = aesKey;
		}

		if (clientID !== undefined) {
			server.set('client_id', clientID.value?.trim() || undefined);
		}

		const newServer = server.toObject();
		const changes: Record<string, {
			old: unknown;
			new: unknown;
		}> = {};

		for (const field of server.modifiedPaths()) {
			const oldValue = oldServer[field as keyof typeof oldServer] ?? null;
			const newValue = newServer[field as keyof typeof newServer] ?? null;

			// * Mongoose marks reassigned fields as modified even if the value is the same
			if (JSON.stringify(oldValue) === JSON.stringify(newValue)) {
				continue;
			}

			// * The AES key is intentionally left out of the audit log, only the fact that it changed is recorded
			if (field === 'aes_key') {
				changes[field] = {
					old: '[REDACTED]',
					new: '[REDACTED]'
				};
			} else {
				changes[field] = {
					old: oldValue,
					new: newValue
				};
			}
		}

		if (Object.keys(changes).length !== 0) {
			await server.save({
				session
			});

			await new AuditLog({
				action_type: AuditLogActionType.AUDIT_LOG_ACTION_TYPE_UPDATE_SERVER,
				executed_by_pid: executor.pid,
				metadata: JSON.stringify({
					server_id: server._id.toString(),
					changes: changes
				})
			}).save({
				session
			});
		}

		await session.commitTransaction();
	} catch (error) {
		await session.abortTransaction();

		if (error instanceof ServerError) {
			throw error;
		}

		LOG_ERROR(`[gRPC] /account.v2.AccountService/UpdateServer: ${error instanceof Error ? error.message : error}`);

		throw new ServerError(Status.INTERNAL, 'Failed to update server');
	} finally {
		await session.endSession();
	}

	return {
		server: {
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
