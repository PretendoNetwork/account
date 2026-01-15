import crypto from 'node:crypto';
import express from 'express';
import { SystemType } from '@/types/common/system-types';
import { TokenType } from '@/types/common/token-types';
import { nintendoBase64Encode, nintendoBase64Decode, nascDateTime, nascError, createServiceToken } from '@/util';
import { getServerByTitleID } from '@/database';
import { IndependentServiceToken } from '@/models/independent_service_token';
import { NEXToken } from '@/models/nex_token';
import type { NASCACRequestParams, NASCLoginACRequestParams, NASCServiceTokenACRequestParams } from '@/types/services/nasc/ac-request-params';
import type { HydratedServerDocument } from '@/types/mongoose/server';

const router = express.Router();

/**
 * [POST]
 * Replacement for: https://nasc.nintendowifi.net/ac
 * Description: Gets a NEX server address and token
 */
router.post('/', async (request: express.Request, response: express.Response): Promise<void> => {
	const requestParams: NASCACRequestParams = request.body;
	const action = nintendoBase64Decode(requestParams.action).toString();
	const titleID = nintendoBase64Decode(requestParams.titleid).toString();
	const gameServerID = nintendoBase64Decode(requestParams.gameid).toString();
	const nexAccount = request.nexAccount;
	let responseData = nascError('null');

	if (!nexAccount) {
		response.status(200).send(responseData.toString());
		return;
	}

	const server = await getServerByTitleID(titleID, nexAccount.server_access_level);

	if (!server || !server.aes_key) {
		response.status(200).send(nascError('110').toString());
		return;
	}

	if (gameServerID !== server.game_server_id) {
		// * If there is a server for a given title ID but it has a different game server ID,
		// * then the title probably requires custom patches. There is an error for an invalid
		// * game ID, but that is irrelevant here since we search the server by the title ID.
		// *
		// * TODO - Keep the original game server ID and add a new "patched" field to support
		// * searching by game server ID in the future.
		// *
		// * 152 is a custom error code
		response.status(200).send(nascError('152').toString());
		return;
	}

	if (server.maintenance_mode) {
		response.status(200).send(nascError('101').toString());
		return;
	}

	if (action === 'LOGIN' && server.port <= 0 && server.ip !== '0.0.0.0') {
		// * Addresses of 0.0.0.0:0 are allowed
		// * They are expected for titles with no NEX server
		response.status(200).send(nascError('110').toString());
		return;
	}

	switch (action) {
		case 'LOGIN':
			responseData = await processLoginRequest(server, nexAccount.pid, requestParams as NASCLoginACRequestParams); // TODO - Remove this "as" with field checking
			break;
		case 'SVCLOC':
			responseData = await processServiceTokenRequest(server, nexAccount.pid, requestParams as NASCServiceTokenACRequestParams); // TODO - Remove this "as" with field checking
			break;
	}

	response.status(200).send(responseData.toString());
});

async function processLoginRequest(server: HydratedServerDocument, pid: number, requestParams: NASCLoginACRequestParams): Promise<URLSearchParams> {
	const titleID = nintendoBase64Decode(requestParams.titleid).toString();
	const token = nintendoBase64Encode(crypto.randomBytes(112));

	await NEXToken.create({
		token: crypto.createHash('sha256').update(token).digest('hex'),
		game_server_id: server.game_server_id,
		pid: pid,
		info: {
			system_type: SystemType.CTR,
			token_type: TokenType.NEX,
			title_id: BigInt(parseInt(titleID, 16)),
			issued: new Date(),
			expires: new Date(Date.now() + (3600 * 1000))
		}
	});

	return new URLSearchParams({
		locator: nintendoBase64Encode(`${server.ip}:${server.port}`),
		retry: nintendoBase64Encode('0'),
		returncd: nintendoBase64Encode('001'),
		token: token,
		datetime: nintendoBase64Encode(nascDateTime())
	});
}

async function processServiceTokenRequest(server: HydratedServerDocument, pid: number, requestParams: NASCServiceTokenACRequestParams): Promise<URLSearchParams> {
	const titleID = nintendoBase64Decode(requestParams.titleid).toString();
	const serviceTokenOptions = {
		pid: pid,
		title_id: titleID,
		issued: new Date(),
		expires: new Date(Date.now() + 24 * 3600 * 1000)
	};

	const token = nintendoBase64Encode(createServiceToken(server, serviceTokenOptions));

	await IndependentServiceToken.create({
		token: crypto.createHash('sha256').update(token).digest('hex'),
		client_id: nintendoBase64Decode(requestParams.keyhash).toString(),
		title_id: serviceTokenOptions.title_id,
		pid: serviceTokenOptions.pid,
		info: {
			system_type: SystemType.CTR,
			token_type: TokenType.IndependentService,
			title_id: BigInt(parseInt(titleID, 16)),
			issued: serviceTokenOptions.issued,
			expires: serviceTokenOptions.expires
		}
	});

	return new URLSearchParams({
		retry: nintendoBase64Encode('0'),
		returncd: nintendoBase64Encode('007'),
		servicetoken: token,
		statusdata: nintendoBase64Encode('Y'),
		svchost: nintendoBase64Encode('n/a'),
		datetime: nintendoBase64Encode(nascDateTime())
	});
}

export default router;
