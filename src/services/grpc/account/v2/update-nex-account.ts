import { Status, ServerError } from 'nice-grpc';
import { AuditLogActionType } from '@pretendonetwork/grpc/account/v2/audit_log_action_type';
import { connection as databaseConnection } from '@/database';
import { LOG_ERROR } from '@/logger';
import { AuditLog } from '@/models/audit-log';
import { NEXAccount } from '@/models/nex-account';
import { getExecutorPNID } from '@/services/grpc/account/v2/utils';
import { PNID_PERMISSION_FLAGS } from '@/types/common/permission-flags';
import type { CallContext } from 'nice-grpc';
import type { UpdateNEXAccountRequest, UpdateNEXAccountResponse } from '@pretendonetwork/grpc/account/v2/update_nex_account_rpc';
import type { HydratedNEXAccountDocument } from '@/types/mongoose/nex-account';

const SERVER_ACCESS_LEVELS = [
	'prod',
	'test',
	'dev'
];

// * -1: banned, 0: standard, 1: tester, 2: mod?, 3: dev
const MIN_ACCESS_LEVEL = -1;
const MAX_ACCESS_LEVEL = 3;

export async function updateNEXAccount(request: UpdateNEXAccountRequest, context: CallContext): Promise<UpdateNEXAccountResponse> {
	const executor = await getExecutorPNID(context, PNID_PERMISSION_FLAGS.MODIFY_NEX_ACCOUNTS);

	if (request.pid === 0) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid NEX account PID');
	}

	const serverAccessLevel = request.serverAccessLevel?.trim();
	const accessLevel = request.accessLevel;

	const session = await databaseConnection().startSession();
	let nexAccount: HydratedNEXAccountDocument | null;

	try {
		session.startTransaction();

		nexAccount = await NEXAccount.findOne({
			pid: request.pid
		}).session(session);

		if (!nexAccount) {
			throw new ServerError(Status.NOT_FOUND, 'NEX account not found');
		}

		const oldNEXAccount = nexAccount.toObject();

		if (serverAccessLevel !== undefined) {
			if (!SERVER_ACCESS_LEVELS.includes(serverAccessLevel)) {
				throw new ServerError(Status.INVALID_ARGUMENT, `Server access level must be one of ${SERVER_ACCESS_LEVELS.join(', ')}`);
			}

			nexAccount.server_access_level = serverAccessLevel;
		}

		if (accessLevel !== undefined) {
			if (!Number.isInteger(accessLevel) || accessLevel < MIN_ACCESS_LEVEL || accessLevel > MAX_ACCESS_LEVEL) {
				throw new ServerError(Status.INVALID_ARGUMENT, `Access level must be between ${MIN_ACCESS_LEVEL} and ${MAX_ACCESS_LEVEL}`);
			}

			nexAccount.access_level = accessLevel;
		}

		const newNEXAccount = nexAccount.toObject();
		const changes: Record<string, {
			old: unknown;
			new: unknown;
		}> = {};

		for (const field of nexAccount.modifiedPaths()) {
			const oldValue = oldNEXAccount[field as keyof typeof oldNEXAccount] ?? null;
			const newValue = newNEXAccount[field as keyof typeof newNEXAccount] ?? null;

			// * Mongoose marks reassigned fields as modified even if the value is the same
			if (JSON.stringify(oldValue) === JSON.stringify(newValue)) {
				continue;
			}

			changes[field] = {
				old: oldValue,
				new: newValue
			};
		}

		if (Object.keys(changes).length !== 0) {
			await nexAccount.save({
				session
			});

			await new AuditLog({
				action_type: AuditLogActionType.AUDIT_LOG_ACTION_TYPE_UPDATE_NEX_ACCOUNT,
				executed_by_pid: executor.pid,
				metadata: JSON.stringify({
					pid: nexAccount.pid,
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

		LOG_ERROR(`[gRPC] /account.v2.AccountService/UpdateNEXAccount: ${error instanceof Error ? error.message : error}`);

		throw new ServerError(Status.INTERNAL, 'Failed to update NEX account');
	} finally {
		await session.endSession();
	}

	return {
		nexAccount: {
			pid: nexAccount.pid,
			owningPid: nexAccount.owning_pid ?? undefined,
			accessLevel: nexAccount.access_level,
			serverAccessLevel: nexAccount.server_access_level,
			friendCode: nexAccount.friend_code || undefined,
			deviceType: nexAccount.device_type || undefined
		}
	};
}
