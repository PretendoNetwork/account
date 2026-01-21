import { Status, ServerError } from 'nice-grpc';
import type { ListAuditLogsRequest, ListAuditLogsResponse } from '@pretendonetwork/grpc/account/v2/list_audit_logs_rpc';

export async function listAuditLogs(_request: ListAuditLogsRequest): Promise<ListAuditLogsResponse> {
	throw new ServerError(
		Status.UNIMPLEMENTED,
		'Stubbed'
	);
}
