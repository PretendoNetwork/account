import { Status, ServerError } from 'nice-grpc';
import type { ListAuditLogCommentsRequest, ListAuditLogCommentsResponse } from '@pretendonetwork/grpc/account/v2/list_audit_log_comments_rpc';

export async function listAuditLogComments(_request: ListAuditLogCommentsRequest): Promise<ListAuditLogCommentsResponse> {
	throw new ServerError(
		Status.UNIMPLEMENTED,
		'Stubbed'
	);
}
