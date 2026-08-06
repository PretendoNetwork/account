import { Status, ServerError } from 'nice-grpc';
import type { UpdateBanRequest, UpdateBanResponse } from '@pretendonetwork/grpc/account/v2/update_ban_rpc';

export async function updateBan(_request: UpdateBanRequest): Promise<UpdateBanResponse> {
	throw new ServerError(
		Status.UNIMPLEMENTED,
		'Stubbed'
	);
}
