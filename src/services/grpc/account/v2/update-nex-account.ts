import { Status, ServerError } from 'nice-grpc';
import type { UpdateNEXAccountRequest, UpdateNEXAccountResponse } from '@pretendonetwork/grpc/account/v2/update_nex_account_rpc';

export async function updateNEXAccount(_request: UpdateNEXAccountRequest): Promise<UpdateNEXAccountResponse> {
	throw new ServerError(
		Status.UNIMPLEMENTED,
		'Stubbed'
	);
}
