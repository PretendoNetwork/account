import { Status, ServerError } from 'nice-grpc';
import type { ListServersRequest, ListServersResponse } from '@pretendonetwork/grpc/account/v2/list_servers_rpc';

export async function listServers(_request: ListServersRequest): Promise<ListServersResponse> {
	throw new ServerError(
		Status.UNIMPLEMENTED,
		'Stubbed'
	);
}
