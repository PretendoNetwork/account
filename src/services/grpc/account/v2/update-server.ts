import { Status, ServerError } from 'nice-grpc';
import type { UpdateServerRequest, UpdateServerResponse } from '@pretendonetwork/grpc/account/v2/update_server_rpc';

export async function updateServer(_request: UpdateServerRequest): Promise<UpdateServerResponse> {
	throw new ServerError(
		Status.UNIMPLEMENTED,
		'Stubbed'
	);
}
