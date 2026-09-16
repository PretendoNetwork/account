import { Status, ServerError } from 'nice-grpc';
import { isValidObjectId, Types } from 'mongoose';
import { AuditLog } from '@/models/audit-log';
import { getExecutorPNID } from '@/services/grpc/account/v2/utils';
import type { CallContext } from 'nice-grpc';
import type { CreateAuditLogCommentRequest, CreateAuditLogCommentResponse } from '@pretendonetwork/grpc/account/v2/create_audit_log_comment_rpc';

export async function createAuditLogComment(request: CreateAuditLogCommentRequest, context: CallContext): Promise<CreateAuditLogCommentResponse> {
	const pnid = await getExecutorPNID(context);

	if (!isValidObjectId(request.id)) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid audit log ID');
	}

	const content = request.content.trim();

	if (content.length === 0) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Comment content cannot be empty');
	}

	const comment = {
		_id: new Types.ObjectId(),
		pid: pnid.pid,
		created: new Date(),
		content
	};

	const result = await AuditLog.updateOne({
		_id: request.id
	}, {
		$push: {
			comments: comment
		}
	});

	if (result.matchedCount === 0) {
		throw new ServerError(Status.NOT_FOUND, 'Audit log not found');
	}

	return {
		item: {
			parent: request.id,
			id: comment._id.toString(),
			pid: comment.pid,
			createdTimestamp: comment.created,
			content: comment.content
		}
	};
}
