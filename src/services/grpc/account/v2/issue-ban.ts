import { Status, ServerError } from 'nice-grpc';
import { AuditLogActionType } from '@pretendonetwork/grpc/account/v2/audit_log_action_type';
import { BanTargetType, BanScopeType } from '@pretendonetwork/grpc/account/v2/ban_details';
import { connection as databaseConnection } from '@/database';
import { LOG_ERROR } from '@/logger';
import { AuditLog } from '@/models/audit-log';
import { Ban, PERMANENT_BAN_END_DATE } from '@/models/ban';
import { Device } from '@/models/device';
import { NEXAccount } from '@/models/nex-account';
import { PNID } from '@/models/pnid';
import { getExecutorPNID } from '@/services/grpc/account/v2/utils';
import { PNID_PERMISSION_FLAGS } from '@/types/common/permission-flags';
import type { CallContext } from 'nice-grpc';
import type { IssueBanRequest, IssueBanResponse } from '@pretendonetwork/grpc/account/v2/issue_ban_rpc';
import type { HydratedBanDocument } from '@/types/mongoose/ban';

const BAN_PERMISSIONS = {
	[BanTargetType.BAN_TARGET_TYPE_NEX_ACCOUNT]: PNID_PERMISSION_FLAGS.BAN_NEX_ACCOUNTS,
	[BanTargetType.BAN_TARGET_TYPE_NETWORK_ACCOUNT]: PNID_PERMISSION_FLAGS.BAN_PNIDS,
	[BanTargetType.BAN_TARGET_TYPE_DEVICE]: PNID_PERMISSION_FLAGS.BAN_CONSOLES
};

const PERMANENT_BAN_ACTION_TYPES = {
	[BanTargetType.BAN_TARGET_TYPE_NEX_ACCOUNT]: AuditLogActionType.AUDIT_LOG_ACTION_TYPE_BAN_NEX_ACCOUNT_PERMANENTLY,
	[BanTargetType.BAN_TARGET_TYPE_NETWORK_ACCOUNT]: AuditLogActionType.AUDIT_LOG_ACTION_TYPE_BAN_NETWORK_ACCOUNT_PERMANENTLY,
	[BanTargetType.BAN_TARGET_TYPE_DEVICE]: AuditLogActionType.AUDIT_LOG_ACTION_TYPE_BAN_DEVICE_PERMANENTLY
};

const TEMPORARY_BAN_ACTION_TYPES = {
	[BanTargetType.BAN_TARGET_TYPE_NEX_ACCOUNT]: AuditLogActionType.AUDIT_LOG_ACTION_TYPE_BAN_NEX_ACCOUNT_TEMPORARILY,
	[BanTargetType.BAN_TARGET_TYPE_NETWORK_ACCOUNT]: AuditLogActionType.AUDIT_LOG_ACTION_TYPE_BAN_NETWORK_ACCOUNT_TEMPORARILY,
	[BanTargetType.BAN_TARGET_TYPE_DEVICE]: AuditLogActionType.AUDIT_LOG_ACTION_TYPE_BAN_DEVICE_TEMPORARILY
};

const SCOPE_TYPES = [
	BanScopeType.BAN_SCOPE_TYPE_ALL,
	BanScopeType.BAN_SCOPE_TYPE_APPLICATION,
	BanScopeType.BAN_SCOPE_TYPE_NEX_SERVICE,
	BanScopeType.BAN_SCOPE_TYPE_INDEPENDENT_SERVICE
];

export async function issueBan(request: IssueBanRequest, context: CallContext): Promise<IssueBanResponse> {
	const details = request.details;

	if (!details) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Missing ban details');
	}

	const targetType = details.targetType;

	if (targetType !== BanTargetType.BAN_TARGET_TYPE_NEX_ACCOUNT && targetType !== BanTargetType.BAN_TARGET_TYPE_NETWORK_ACCOUNT && targetType !== BanTargetType.BAN_TARGET_TYPE_DEVICE) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid ban target type');
	}

	const executor = await getExecutorPNID(context, BAN_PERMISSIONS[targetType]);

	const target = details.target.trim();
	const issuer = details.issuer.trim() || executor.pid.toString();
	const startDate = details.startDate ?? new Date();
	const endDate = details.endDate ?? PERMANENT_BAN_END_DATE;
	const scopeType = details.scopeType;
	const scopeTarget = details.scopeTarget.trim();
	const reason = details.reason.trim();

	if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid ban start or end date');
	}

	if (endDate > PERMANENT_BAN_END_DATE) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Ban end date cannot be after the permanent ban end date');
	}

	if (endDate <= startDate) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Ban end date must be after the start date');
	}

	if (!SCOPE_TYPES.includes(scopeType)) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid ban scope type');
	}

	if (scopeType !== BanScopeType.BAN_SCOPE_TYPE_ALL && scopeTarget.length === 0) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Ban scope target cannot be empty unless the scope is all services');
	}

	if (reason.length === 0) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Ban reason cannot be empty');
	}

	let targetExists = false;

	if (targetType === BanTargetType.BAN_TARGET_TYPE_NEX_ACCOUNT) {
		targetExists = !!await NEXAccount.exists({
			pid: Number(target)
		});
	}

	if (targetType === BanTargetType.BAN_TARGET_TYPE_NETWORK_ACCOUNT) {
		targetExists = !!await PNID.exists({
			pid: Number(target)
		});
	}

	// * Devices are banned by their certificate hash. On NNAS this is the hash of the
	// * x-nintendo-device-cert header, on NASC this is the hash of the fcdcert
	if (targetType === BanTargetType.BAN_TARGET_TYPE_DEVICE) {
		targetExists = !!await Device.exists({
			$or: [
				{
					certificate_hash: target
				},
				{
					fcdcert_hash: target
				}
			]
		});
	}

	if (!targetExists) {
		throw new ServerError(Status.NOT_FOUND, 'Ban target not found');
	}

	const isPermanent = endDate.getTime() === PERMANENT_BAN_END_DATE.getTime();
	const session = await databaseConnection().startSession();
	let ban: HydratedBanDocument;

	try {
		session.startTransaction();

		const now = new Date();

		ban = new Ban({
			target_type: targetType,
			target: target,
			issuer: issuer,
			start_date: startDate,
			end_date: endDate,
			scope_type: scopeType,
			scope_target: scopeTarget,
			reason: reason,
			issued_date: now,
			updated_date: now
		});

		await ban.save({
			session
		});

		await new AuditLog({
			action_type: isPermanent ? PERMANENT_BAN_ACTION_TYPES[targetType] : TEMPORARY_BAN_ACTION_TYPES[targetType],
			executed_by_pid: executor.pid,
			metadata: JSON.stringify({
				ban_id: ban._id.toString(),
				target_type: ban.target_type,
				target: ban.target,
				issuer: ban.issuer,
				start_date: ban.start_date,
				end_date: ban.end_date,
				scope_type: ban.scope_type,
				scope_target: ban.scope_target,
				reason: ban.reason
			})
		}).save({
			session
		});

		await session.commitTransaction();
	} catch (error) {
		await session.abortTransaction();

		LOG_ERROR(`[gRPC] /account.v2.AccountService/IssueBan: ${error instanceof Error ? error.message : error}`);

		throw new ServerError(Status.INTERNAL, 'Failed to issue ban');
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
