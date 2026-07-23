import { Status, ServerError } from 'nice-grpc';
import type { GetPNIDRequest, GetPNIDResponse } from '@pretendonetwork/grpc/account/v2/get_pnid_rpc';

export async function getPNID(_request: GetPNIDRequest): Promise<GetPNIDResponse> {
	throw new ServerError(
		Status.UNIMPLEMENTED,
		'Stubbed'
	);
}
