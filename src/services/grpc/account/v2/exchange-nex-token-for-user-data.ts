import crypto from 'node:crypto';
import { Status, ServerError } from 'nice-grpc';
import { NEXToken } from '@/models/nex_token';
import { NEXAccount } from '@/models/nex-account';
import type { ExchangeNEXTokenForUserDataRequest, ExchangeNEXTokenForUserDataResponse } from '@pretendonetwork/grpc/account/v2/exchange_nex_token_for_user_data_rpc';
import type { HydratedNEXAccountDocument } from '@/types/mongoose/nex-account';
import type { HydratedNEXTokenDocument } from '@/models/nex_token';

export async function exchangeNEXTokenForUserData(request: ExchangeNEXTokenForUserDataRequest): Promise<ExchangeNEXTokenForUserDataResponse> {
	let nexAccount: HydratedNEXAccountDocument | null = null;
	let nexToken: HydratedNEXTokenDocument | null = null;
	try {
		nexToken = await NEXToken.findOne({
			token: crypto.createHash('sha256').update(request.token).digest('hex')
		});

		if (!nexToken) {
			throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid token');
		}

		// TODO - Add checks for the game server ID and matching system/token types here

		if (nexToken.info.expires < new Date()) {
			throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid token');
		}

		nexAccount = await NEXAccount.findOne({ pid: nexToken.pid });
	} catch {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid token');
	}

	if (!nexAccount) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid token. No user found');
	}

	return {
		nexAccount: {
			pid: nexAccount.pid,
			owningPid: nexAccount.owning_pid,
			accessLevel: nexAccount.access_level,
			serverAccessLevel: nexAccount.server_access_level,
			friendCode: nexAccount.friend_code,
			deviceType: nexAccount.device_type
		},
		tokenInfo: {
			systemType: nexToken.info.system_type as any, // TODO - Stop the any usage
			tokenType: nexToken.info.system_type as any, // TODO - Stop the any usage
			pid: BigInt(nexAccount.pid),
			accessLevel: nexAccount.access_level,
			titleId: nexToken.info.title_id,
			issueTime: nexToken.info.issued,
			expireTime: nexToken.info.expires
		}
	};
}
