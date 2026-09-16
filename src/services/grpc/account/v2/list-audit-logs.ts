import { AuditLog } from '@/models/audit-log';
import type { FilterQuery } from 'mongoose';
import type { ListAuditLogsRequest, ListAuditLogsResponse } from '@pretendonetwork/grpc/account/v2/list_audit_logs_rpc';
import type { IAuditLog } from '@/types/mongoose/audit-log';

// * These seem sensible to me
const DEFAULT_PAGE_LIMIT = 50;
const MAX_PAGE_LIMIT = 500;

export async function listAuditLogs(request: ListAuditLogsRequest): Promise<ListAuditLogsResponse> {
	const limit = Math.min(request.page?.limit || DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);
	const offset = request.page?.offset ?? 0;
	const filter: FilterQuery<IAuditLog> = {};

	if (request.filter) {
		if (request.filter.executedByPid.length !== 0) {
			filter.executed_by_pid = {
				$in: request.filter.executedByPid
			};
		}

		if (request.filter.actionType.length !== 0) {
			filter.action_type = {
				$in: request.filter.actionType
			};
		}

		// * extra_json is currently unused. See https://github.com/PretendoNetwork/grpc/pull/10#discussion_r2637508248
	}

	const [total, auditLogs] = await Promise.all([
		AuditLog.countDocuments(filter),
		AuditLog.find(filter).sort({
			created: -1,
			_id: -1
		}).skip(offset).limit(limit)
	]);

	return {
		page: {
			total,
			offset,
			itemCount: auditLogs.length
		},
		items: auditLogs.map(auditLog => ({
			id: auditLog._id.toString(),
			actionType: auditLog.action_type,
			executedByPid: auditLog.executed_by_pid,
			createdTimestamp: BigInt(auditLog.created.getTime()),
			commentCount: auditLog.comments.length,
			metadataJson: auditLog.metadata
		}))
	};
}
