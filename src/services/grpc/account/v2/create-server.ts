import { Status, ServerError } from 'nice-grpc';
import type { CreateServerRequest, CreateServerResponse } from '@pretendonetwork/grpc/account/v2/create_server_rpc';

export async function createServer(_request: CreateServerRequest): Promise<CreateServerResponse> {
	throw new ServerError(
		Status.UNIMPLEMENTED,
		'Stubbed'
	);
}
