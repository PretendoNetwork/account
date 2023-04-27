import express from 'express';
import { nintendoBase64Encode, nintendoBase64Decode, nascError, generateToken } from '@/util';
import { getServerByTitleId } from '@/database';
import { TokenOptions } from '@/types/common/token-options';
import { NASCRequestParams } from '@/types/services/nasc/request-params';
import { HydratedNEXAccountDocument } from '@/types/mongoose/nex-account';
import { HydratedServerDocument } from '@/types/mongoose/server';

const router: express.Router = express.Router();

/**
 * [POST]
 * Replacement for: https://nasc.nintendowifi.net/ac
 * Description: Gets a NEX server address and token
 */
router.post('/', async (request: express.Request, response: express.Response) => {
	const requestParams: NASCRequestParams = request.body;
	const action: string = nintendoBase64Decode(requestParams.action).toString();
	const titleID: string = nintendoBase64Decode(requestParams.titleid).toString();
	const nexAccount: HydratedNEXAccountDocument | null = request.nexAccount;
	let responseData: URLSearchParams = nascError('null');

	if (!nexAccount) {
		return response.status(200).send(responseData.toString());
	}

	// TODO: REMOVE AFTER PUBLIC LAUNCH
	// * LET EVERYONE IN THE `test` FRIENDS SERVER
	// * THAT WAY EVERYONE CAN GET AN ASSIGNED PID
	let serverAccessLevel: string = 'test';
	if (titleID !== '0004013000003202') {
		serverAccessLevel = nexAccount.server_access_level;
	}

	const server: HydratedServerDocument | null = await getServerByTitleId(titleID, serverAccessLevel);

	if (!server || !server.aes_key) {
		return response.status(200).send( nascError('110').toString());
	}

	if (action === 'LOGIN' && server.port <= 0 && server.ip !== '0.0.0.0') {
		// * Addresses of 0.0.0.0:0 are allowed
		// * They are expected for titles with no NEX server
		return response.status(200).send( nascError('110').toString());
	}

	switch (action) {
		case 'LOGIN':
			responseData = await processLoginRequest(server, nexAccount.pid, titleID);
			break;
		case 'SVCLOC':
			responseData = await processServiceTokenRequest(server, nexAccount.pid, titleID);
			break;
	}

	response.status(200).send(responseData.toString());
});

async function processLoginRequest(server: HydratedServerDocument, pid: number, titleID: string): Promise<URLSearchParams> {
	const tokenOptions: TokenOptions = {
		system_type: 0x2, // * 3DS
		token_type: 0x3, // * NEX token
		pid: pid,
		access_level: 0,
		title_id: BigInt(parseInt(titleID, 16)),
		expire_time: BigInt(Date.now() + (3600 * 1000))
	};

	// TODO - Handle null tokens

	const nexTokenBuffer: Buffer | null = await generateToken(server.aes_key, tokenOptions);
	const nexToken: string = nintendoBase64Encode(nexTokenBuffer || '');

	return new URLSearchParams({
		locator: nintendoBase64Encode(`${server.ip}:${server.port}`),
		retry: nintendoBase64Encode('0'),
		returncd: nintendoBase64Encode('001'),
		token: nexToken,
		datetime: nintendoBase64Encode(Date.now().toString()),
	});
}

async function processServiceTokenRequest(server: HydratedServerDocument, pid: number, titleID: string): Promise<URLSearchParams> {
	const tokenOptions: TokenOptions = {
		system_type: 0x2, // * 3DS
		token_type: 0x4, // * Service token
		pid: pid,
		access_level: 0,
		title_id: BigInt(parseInt(titleID, 16)),
		expire_time: BigInt(Date.now() + (3600 * 1000))
	};

	// TODO - Handle null tokens

	const serviceTokenBuffer: Buffer | null = await generateToken(server.aes_key, tokenOptions);
	const serviceToken: string = nintendoBase64Encode(serviceTokenBuffer || '');

	return new URLSearchParams({
		retry: nintendoBase64Encode('0'),
		returncd: nintendoBase64Encode('007'),
		servicetoken: serviceToken,
		statusdata: nintendoBase64Encode('Y'),
		svchost: nintendoBase64Encode('n/a'),
		datetime: nintendoBase64Encode(Date.now().toString()),
	});
}

export default router;