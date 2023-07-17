import { Status, ServerError } from 'nice-grpc';
import {GetNEXDataRequest,GetNEXDataResponse, DeepPartial } from 'pretendo-grpc-ts/dist/account/get_nex_data_rpc';
import { NEXAccount } from '@/models/nex-account';
import { HydratedNEXAccountDocument } from '@/types/mongoose/nex-account';

export async function getNEXData(request: GetNEXDataRequest): Promise<DeepPartial<GetNEXDataResponse>> {
	const nexAccount: HydratedNEXAccountDocument | null = await NEXAccount.findOne({ pid: request.pid });

	if (!nexAccount) {
		throw new ServerError(
			Status.INVALID_ARGUMENT,
			'No NEX account found',
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
