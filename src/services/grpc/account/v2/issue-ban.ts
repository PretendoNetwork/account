import { Status, ServerError } from 'nice-grpc';
import type { IssueBanRequest, IssueBanResponse } from '@pretendonetwork/grpc/account/v2/issue_ban_rpc';

export async function issueBan(_request: IssueBanRequest): Promise<IssueBanResponse> {
	throw new ServerError(
		Status.UNIMPLEMENTED,
		'Stubbed'
	);
}
