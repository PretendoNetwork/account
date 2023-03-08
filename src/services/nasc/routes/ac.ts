import express from 'express';
import util from '@/util';
import database from '@/database';
import cache from '@/cache';
import { CryptoOptions } from '@/types/common/crypto-options';
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
	const action: string = util.nintendoBase64Decode(requestParams.action).toString();
	let responseData: URLSearchParams;

	switch (action) {
		case 'LOGIN':
			responseData = await processLoginRequest(request);
			break;
		case 'SVCLOC':
			responseData = await processServiceTokenRequest(request);
			break;
	}

	response.status(200).send(responseData.toString());
});

async function processLoginRequest(request: express.Request): Promise<URLSearchParams> {
	const requestParams: NASCRequestParams = request.body;
	const titleID: string = util.nintendoBase64Decode(requestParams.titleid).toString();
	const nexUser: HydratedNEXAccountDocument = request.nexUser;

	// TODO: REMOVE AFTER PUBLIC LAUNCH
	// LET EVERYONE IN THE `test` FRIENDS SERVER
	// THAT WAY EVERYONE CAN GET AN ASSIGNED PID
	let serverAccessLevel: string = 'test';
	if (titleID !== '0004013000003202') {
		serverAccessLevel = nexUser.server_access_level;
	}

	const server: HydratedServerDocument = await database.getServerByTitleId(titleID, serverAccessLevel);

	if (!server || !server.service_name || !server.ip || !server.port) {
		return util.nascError('110');
	}

	const serverName: string = server.service_name;
	const ip: string = server.ip;
	const port: number = server.port;

	const publicKey: Buffer = await cache.getNEXPublicKey(serverName);
	const secretKey: Buffer = await cache.getNEXSecretKey(serverName);

	const cryptoOptions: CryptoOptions = {
		public_key: publicKey,
		hmac_secret: secretKey
	};

	const tokenOptions: TokenOptions = {
		system_type: 0x2, // 3DS
		token_type: 0x3, // nex token,
		pid: nexUser.pid,
		access_level: 0,
		title_id: BigInt(parseInt(titleID, 16)),
		expire_time: BigInt(Date.now() + (3600 * 1000))
	};

	let nexToken: string = await util.generateToken(cryptoOptions, tokenOptions);
	nexToken = util.nintendoBase64Encode(Buffer.from(nexToken, 'base64'));

	return new URLSearchParams({
		locator: util.nintendoBase64Encode(`${ip}:${port}`),
		retry: util.nintendoBase64Encode('0'),
		returncd: util.nintendoBase64Encode('001'),
		token: nexToken,
		datetime: util.nintendoBase64Encode(Date.now().toString()),
	});
}

async function processServiceTokenRequest(_request: express.Request): Promise<URLSearchParams> {
	return new URLSearchParams({
		retry: util.nintendoBase64Encode('0'),
		returncd: util.nintendoBase64Encode('007'),
		servicetoken: util.nintendoBase64Encode(Buffer.alloc(64).toString()), // hard coded for now
		statusdata: util.nintendoBase64Encode('Y'),
		svchost: util.nintendoBase64Encode('n/a'),
		datetime: util.nintendoBase64Encode(Date.now().toString()),
	});
}

export default router;