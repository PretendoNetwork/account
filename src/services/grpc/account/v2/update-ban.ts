import { Status, ServerError } from 'nice-grpc';
import { isValidObjectId } from 'mongoose';
import { AuditLogActionType } from '@pretendonetwork/grpc/account/v2/audit_log_action_type';
import { BanTargetType, BanScopeType } from '@pretendonetwork/grpc/account/v2/ban_details';
import { connection as databaseConnection } from '@/database';
import { LOG_ERROR } from '@/logger';
import { AuditLog } from '@/models/audit-log';
import { Ban, PERMANENT_BAN_END_DATE } from '@/models/ban';
import { getExecutorPNID } from '@/services/grpc/account/v2/utils';
import { PNID_PERMISSION_FLAGS } from '@/types/common/permission-flags';
import type { CallContext } from 'nice-grpc';
import type { UpdateBanRequest, UpdateBanResponse } from '@pretendonetwork/grpc/account/v2/update_ban_rpc';
import type { HydratedBanDocument } from '@/types/mongoose/ban';

const BAN_PERMISSIONS = {
	[BanTargetType.BAN_TARGET_TYPE_NEX_ACCOUNT]: PNID_PERMISSION_FLAGS.BAN_NEX_ACCOUNTS,
	[BanTargetType.BAN_TARGET_TYPE_NETWORK_ACCOUNT]: PNID_PERMISSION_FLAGS.BAN_PNIDS,
	[BanTargetType.BAN_TARGET_TYPE_DEVICE]: PNID_PERMISSION_FLAGS.BAN_CONSOLES
};

const SCOPE_TYPES = [
	BanScopeType.BAN_SCOPE_TYPE_ALL,
	BanScopeType.BAN_SCOPE_TYPE_APPLICATION,
	BanScopeType.BAN_SCOPE_TYPE_NEX_SERVICE,
	BanScopeType.BAN_SCOPE_TYPE_INDEPENDENT_SERVICE
];

export async function updateBan(request: UpdateBanRequest, context: CallContext): Promise<UpdateBanResponse> {
	// * The required permission depends on the ban target type, so that is checked once the ban is found
	const executor = await getExecutorPNID(context);

	if (!isValidObjectId(request.id)) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid ban ID');
	}

	const startDate = request.startDate;
	const endDate = request.endDate;
	const scopeType = request.scopeType;
	const scopeTarget = request.scopeTarget?.trim();
	const reason = request.reason?.trim();
	const pardonReason = request.pardonReason?.trim();

	const session = await databaseConnection().startSession();
	let ban: HydratedBanDocument | null;

	try {
		session.startTransaction();

		ban = await Ban.findById(request.id).session(session);

		if (!ban) {
			throw new ServerError(Status.NOT_FOUND, 'Ban not found');
		}

		const permission = BAN_PERMISSIONS[ban.target_type as keyof typeof BAN_PERMISSIONS];

		if (!permission || !executor.hasPermission(permission)) {
			throw new ServerError(Status.PERMISSION_DENIED, 'Executor lacks the required permission');
		}

		const oldBan = Ban.hydrate(ban.toObject());

		if (startDate !== undefined) {
			if (isNaN(startDate.getTime())) {
				throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid ban start date');
			}

			ban.start_date = startDate;
		}

		if (endDate !== undefined) {
			if (isNaN(endDate.getTime())) {
				throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid ban end date');
			}

			if (endDate > PERMANENT_BAN_END_DATE) {
				throw new ServerError(Status.INVALID_ARGUMENT, 'Ban end date cannot be after the permanent ban end date');
			}

			ban.end_date = endDate;
		}

		if (ban.end_date <= ban.start_date) {
			throw new ServerError(Status.INVALID_ARGUMENT, 'Ban end date must be after the start date');
		}

		if (scopeType !== undefined) {
			if (!SCOPE_TYPES.includes(scopeType)) {
				throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid ban scope type');
			}

			ban.scope_type = scopeType;
		}

		if (scopeTarget !== undefined) {
			ban.scope_target = scopeTarget;
		}

		if (ban.scope_type !== BanScopeType.BAN_SCOPE_TYPE_ALL && ban.scope_target.length === 0) {
			throw new ServerError(Status.INVALID_ARGUMENT, 'Ban scope target cannot be empty unless the scope is all services');
		}

		if (reason !== undefined) {
			if (reason.length === 0) {
				throw new ServerError(Status.INVALID_ARGUMENT, 'Ban reason cannot be empty');
			}

			ban.reason = reason;
		}

		if (pardonReason !== undefined) {
			if (!ban.pardoned_date) {
				throw new ServerError(Status.FAILED_PRECONDITION, 'Cannot update the pardon reason of a ban that has not been pardoned');
			}

			if (pardonReason.length === 0) {
				throw new ServerError(Status.INVALID_ARGUMENT, 'Pardon reason cannot be empty');
			}

			ban.pardoned_reason = pardonReason;
		}

		const changes: Record<string, {
			old: unknown;
			new: unknown;
		}> = {};

		for (const path of ban.directModifiedPaths()) {
			const oldValue = oldBan.get(path) ?? null;
			const newValue = ban.get(path) ?? null;

			// * Mongoose marks reassigned fields as modified even if the value is the same
			if (JSON.stringify(oldValue) === JSON.stringify(newValue)) {
				continue;
			}

			changes[path] = {
				old: oldValue,
				new: newValue
			};
		}

		if (Object.keys(changes).length !== 0) {
			ban.updated_date = new Date();

			await ban.save({
				session
			});

			await new AuditLog({
				action_type: AuditLogActionType.AUDIT_LOG_ACTION_TYPE_UPDATE_BAN,
				executed_by_pid: executor.pid,
				metadata: JSON.stringify({
					ban_id: ban._id.toString(),
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

		LOG_ERROR(`[gRPC] /account.v2.AccountService/UpdateBan: ${error instanceof Error ? error.message : error}`);

		throw new ServerError(Status.INTERNAL, 'Failed to update ban');
	} finally {
		await session.endSession();
	}

	return {
		ban: {
			id: ban._id.toString(),
			details: {
				targetType: ban.target_type,
				target: ban.target,
				issuer: ban.issuer,
				startDate: ban.start_date,
				endDate: ban.end_date,
				scopeType: ban.scope_type,
				scopeTarget: ban.scope_target,
				reason: ban.reason
			},
			issuedDate: ban.issued_date,
			updatedDate: ban.updated_date,
			pardonedDate: ban.pardoned_date,
			pardonedReason: ban.pardoned_reason
		}
	};
}
