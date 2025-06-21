import { Status, ServerError } from 'nice-grpc';
import { NEXAccount } from '@/models/nex-account';
import type { GetNEXDataRequest, GetNEXDataResponse, DeepPartial } from '@pretendonetwork/grpc/account/get_nex_data_rpc';

export async function getNEXData(request: GetNEXDataRequest): Promise<DeepPartial<GetNEXDataResponse>> {
	const nexAccount = await NEXAccount.findOne({ pid: request.pid });

	if (!nexAccount) {
		throw new ServerError(
			Status.INVALID_ARGUMENT,
			'No NEX account found'
		);
	}

	return {
		pid: nexAccount.pid,
		password: nexAccount.password,
		owningPid: nexAccount.owning_pid,
		accessLevel: nexAccount.access_level,
		serverAccessLevel: nexAccount.server_access_level,
		friendCode: nexAccount.friend_code
	};
}
