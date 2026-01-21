import crypto from 'node:crypto';
import { Status, ServerError } from 'nice-grpc';
import { Server } from '@/models/server';
import { PNID } from '@/models/pnid';
import { NEXAccount } from '@/models/nex-account';
import type { ValidateIndependentServiceTokenRequest, ValidateIndependentServiceTokenResponse } from '@pretendonetwork/grpc/account/v2/validate_independent_service_token_rpc';
import type { HydratedServerDocument } from '@/types/mongoose/server';

export async function validateIndependentServiceToken(request: ValidateIndependentServiceTokenRequest): Promise<ValidateIndependentServiceTokenResponse> {
	if (request.clientIds.length === 0) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'No server identification data sent');
	}

	let server: HydratedServerDocument | null = null;
	try {
		server = await Server.findOne({
			client_id: {
				$in: request.clientIds
			}
		});
	} catch {
		return {
			isValid: false
		};
	}

	if (!server) {
		return {
			isValid: false
		};
	}

	const token = Buffer.from(request.token, 'hex');

	if (token.length !== 60) {
		return {
			isValid: false
		};
	}

	const tokenBody = token.subarray(0, 28);
	const expectedHMAC = token.subarray(28);
	const calculatedHMAC = crypto.createHmac('sha256', server.aes_key).update(tokenBody).digest();

	if (!crypto.timingSafeEqual(expectedHMAC, calculatedHMAC)) {
		return {
			isValid: false
		};
	}

	// TODO - Add ban lookups once bans are no longer stubbed
	const pid = tokenBody.readUInt32BE(0);

	const nexAccount = await NEXAccount.findOne({
		pid: pid
	});

	if (!nexAccount) {
		return {
			isValid: false
		};
	}

	const pnid = await PNID.findOne({
		pid: pid
	});

	if (pnid) {
		return {
			isValid: true,
			basicUserInfo: {
				// TODO - ban: {}
				accessBetaServers: pnid.access_level === 1 || pnid.access_level === 2 || pnid.access_level === 3, // TODO - Remove with a better permission check later
				accessDeveloperServers: pnid.access_level === 3 // TODO - Remove with a better permission check later
			}
		};
	} else {
		return {
			isValid: true,
			basicUserInfo: {
				accessBetaServers: nexAccount.access_level === 1 || nexAccount.access_level === 2 || nexAccount.access_level === 3, // TODO - Remove with a better permission check later
				accessDeveloperServers: nexAccount.access_level === 3 // TODO - Remove with a better permission check later
			}
		};
	}
}
