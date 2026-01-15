import { Status, ServerError } from 'nice-grpc';
import type { CreateAuditLogCommentRequest, CreateAuditLogCommentResponse } from '@pretendonetwork/grpc/account/v2/create_audit_log_comment_rpc';

export async function createAuditLogComment(_request: CreateAuditLogCommentRequest): Promise<CreateAuditLogCommentResponse> {
	throw new ServerError(
		Status.UNIMPLEMENTED,
		'Stubbed'
	);
}
