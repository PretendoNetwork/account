import { Status, ServerError } from 'nice-grpc';
import type { ListBansRequest, ListBansResponse } from '@pretendonetwork/grpc/account/v2/list_bans_rpc';

export async function listBans(_request: ListBansRequest): Promise<ListBansResponse> {
	throw new ServerError(
		Status.UNIMPLEMENTED,
		'Stubbed'
	);
}
