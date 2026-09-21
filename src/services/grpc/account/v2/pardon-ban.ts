import { Status, ServerError } from 'nice-grpc';
import { isValidObjectId } from 'mongoose';
import { AuditLogActionType } from '@pretendonetwork/grpc/account/v2/audit_log_action_type';
import { BanTargetType } from '@pretendonetwork/grpc/account/v2/ban_details';
import { connection as databaseConnection } from '@/database';
import { LOG_ERROR } from '@/logger';
import { AuditLog } from '@/models/audit-log';
import { Ban } from '@/models/ban';
import { getExecutorPNID } from '@/services/grpc/account/v2/utils';
import { PNID_PERMISSION_FLAGS } from '@/types/common/permission-flags';
import type { CallContext } from 'nice-grpc';
import type { PardonBanRequest, PardonBanResponse } from '@pretendonetwork/grpc/account/v2/pardon_ban_rpc';
import type { HydratedBanDocument } from '@/types/mongoose/ban';

const BAN_PERMISSIONS = {
	[BanTargetType.BAN_TARGET_TYPE_NEX_ACCOUNT]: PNID_PERMISSION_FLAGS.BAN_NEX_ACCOUNTS,
	[BanTargetType.BAN_TARGET_TYPE_NETWORK_ACCOUNT]: PNID_PERMISSION_FLAGS.BAN_PNIDS,
	[BanTargetType.BAN_TARGET_TYPE_DEVICE]: PNID_PERMISSION_FLAGS.BAN_CONSOLES
};

export async function pardonBan(request: PardonBanRequest, context: CallContext): Promise<PardonBanResponse> {
	// * The required permission depends on the ban target type, so that is checked once the ban is found
	const executor = await getExecutorPNID(context);

	if (!isValidObjectId(request.id)) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid ban ID');
	}

	const reason = request.reason.trim();

	if (reason.length === 0) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Pardon reason cannot be empty');
	}

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

		if (ban.pardoned_date) {
			throw new ServerError(Status.FAILED_PRECONDITION, 'Ban has already been pardoned');
		}

		const now = new Date();

		ban.pardoned_date = now;
		ban.pardoned_reason = reason;
		ban.updated_date = now;

		await ban.save({
			session
		});

		await new AuditLog({
			action_type: AuditLogActionType.AUDIT_LOG_ACTION_TYPE_PARDON_BAN,
			executed_by_pid: executor.pid,
			metadata: JSON.stringify({
				ban_id: ban._id.toString(),
				pardoned_reason: reason
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

		LOG_ERROR(`[gRPC] /account.v2.AccountService/PardonBan: ${error instanceof Error ? error.message : error}`);

		throw new ServerError(Status.INTERNAL, 'Failed to pardon ban');
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
