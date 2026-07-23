import { Status, ServerError } from 'nice-grpc';
import type { GetNEXAccountRequest, GetNEXAccountResponse } from '@pretendonetwork/grpc/account/v2/get_nex_account_rpc';

export async function getNEXAccount(_request: GetNEXAccountRequest): Promise<GetNEXAccountResponse> {
	throw new ServerError(
		Status.UNIMPLEMENTED,
		'Stubbed'
	);
}
