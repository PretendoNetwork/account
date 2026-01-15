import { Status, ServerError } from 'nice-grpc';
import type { UpdatePNIDRequest, UpdatePNIDResponse } from '@pretendonetwork/grpc/account/v2/update_pnid_rpc';

export async function updatePNID(_request: UpdatePNIDRequest): Promise<UpdatePNIDResponse> {
	throw new ServerError(
		Status.UNIMPLEMENTED,
		'Stubbed'
	);
}
