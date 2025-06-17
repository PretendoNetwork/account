import { Status, ServerError } from 'nice-grpc';
import { NEXAccount } from '@/models/nex-account';
import type { GetNEXPasswordRequest, GetNEXPasswordResponse, DeepPartial } from '@pretendonetwork/grpc/account/v2/get_nex_password_rpc';

export async function getNEXPassword(request: GetNEXPasswordRequest): Promise<DeepPartial<GetNEXPasswordResponse>> {
	const nexAccount = await NEXAccount.findOne({ pid: request.pid });

	if (!nexAccount) {
		throw new ServerError(
			Status.INVALID_ARGUMENT,
			'No NEX account found'
		);
	}

	return {
		password: nexAccount.password
	};
}
