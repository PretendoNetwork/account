import { Status, ServerError } from 'nice-grpc';
import type { DeletePNIDRequest, DeletePNIDResponse } from '@pretendonetwork/grpc/account/v2/delete_pnid_rpc';

export async function deletePNID(_request: DeletePNIDRequest): Promise<DeletePNIDResponse> {
	throw new ServerError(
		Status.UNIMPLEMENTED,
		'Stubbed'
	);
}
