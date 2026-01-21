import { Status, ServerError } from 'nice-grpc';
import type { DeleteServerRequest, DeleteServerResponse } from '@pretendonetwork/grpc/account/v2/delete_server_rpc';

export async function deleteServer(_request: DeleteServerRequest): Promise<DeleteServerResponse> {
	throw new ServerError(
		Status.UNIMPLEMENTED,
		'Stubbed'
	);
}
