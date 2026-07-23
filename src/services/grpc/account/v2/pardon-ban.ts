import { Status, ServerError } from 'nice-grpc';
import type { PardonBanRequest, PardonBanResponse } from '@pretendonetwork/grpc/account/v2/pardon_ban_rpc';

export async function pardonBan(_request: PardonBanRequest): Promise<PardonBanResponse> {
	throw new ServerError(
		Status.UNIMPLEMENTED,
		'Stubbed'
	);
}
