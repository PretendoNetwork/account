import { Status, ServerError } from 'nice-grpc';
import type { ListPNIDsRequest, ListPNIDsResponse } from '@pretendonetwork/grpc/account/v2/list_pnids_rpc';

export async function listPNIDs(_request: ListPNIDsRequest): Promise<ListPNIDsResponse> {
	throw new ServerError(
		Status.UNIMPLEMENTED,
		'Stubbed'
	);
}
