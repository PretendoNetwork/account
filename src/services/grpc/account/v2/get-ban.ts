import { Status, ServerError } from 'nice-grpc';
import type { GetBanRequest, GetBanResponse } from '@pretendonetwork/grpc/account/v2/get_ban_rpc';

export async function getBan(_request: GetBanRequest): Promise<GetBanResponse> {
	throw new ServerError(
		Status.UNIMPLEMENTED,
		'Stubbed'
	);
}
