import { Status, ServerError } from 'nice-grpc';
import type { ListBanCommentsRequest, ListBanCommentsResponse } from '@pretendonetwork/grpc/account/v2/list_ban_comments_rpc';

export async function listBanComments(_request: ListBanCommentsRequest): Promise<ListBanCommentsResponse> {
	throw new ServerError(
		Status.UNIMPLEMENTED,
		'Stubbed'
	);
}
