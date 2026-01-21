import { Status, ServerError } from 'nice-grpc';
import type { GetServerRequest, GetServerResponse } from '@pretendonetwork/grpc/account/v2/get_server_rpc';

export async function getServer(_request: GetServerRequest): Promise<GetServerResponse> {
	throw new ServerError(
		Status.UNIMPLEMENTED,
		'Stubbed'
	);
}
