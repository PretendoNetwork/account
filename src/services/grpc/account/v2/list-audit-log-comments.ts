import { Status, ServerError } from 'nice-grpc';
import { isValidObjectId } from 'mongoose';
import { AuditLog } from '@/models/audit-log';
import type { ListAuditLogCommentsRequest, ListAuditLogCommentsResponse } from '@pretendonetwork/grpc/account/v2/list_audit_log_comments_rpc';

export async function listAuditLogComments(request: ListAuditLogCommentsRequest): Promise<ListAuditLogCommentsResponse> {
	if (!isValidObjectId(request.id)) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid audit log ID');
	}

	const auditLog = await AuditLog.findById(request.id, {
		comments: 1
	});

	if (!auditLog) {
		throw new ServerError(Status.NOT_FOUND, 'Audit log not found');
	}

	return {
		items: auditLog.comments.map(comment => ({
			parent: auditLog._id.toString(),
			id: comment._id.toString(),
			pid: comment.pid,
			createdTimestamp: comment.created,
			content: comment.content
		}))
	};
}
