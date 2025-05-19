import express from 'express';
import { nintendoBase64Encode, nintendoBase64Decode, nascDateTime, nascError, generateToken } from '@/util';
import { getServerByTitleID } from '@/database';
import type { NASCRequestParams } from '@/types/services/nasc/request-params';
import type { HydratedServerDocument } from '@/types/mongoose/server';

const router = express.Router();

/**
 * [POST]
 * Replacement for: https://nasc.nintendowifi.net/ac
 * Description: Gets a NEX server address and token
 */
router.post('/', async (request: express.Request, response: express.Response): Promise<void> => {
	const requestParams: NASCRequestParams = request.body;
	const action = nintendoBase64Decode(requestParams.action).toString();
	const titleID = nintendoBase64Decode(requestParams.titleid).toString();
	const nexAccount = request.nexAccount;
	let responseData = nascError('null');

	if (!nexAccount) {
		response.status(200).send(responseData.toString());
		return;
	}

	// TODO - REMOVE AFTER PUBLIC LAUNCH
	// * LET EVERYONE IN THE `test` FRIENDS SERVER
	// * THAT WAY EVERYONE CAN GET AN ASSIGNED PID
	let serverAccessLevel = 'test';
	if (titleID !== '0004013000003202') {
		serverAccessLevel = nexAccount.server_access_level;
	}

	const server = await getServerByTitleID(titleID, serverAccessLevel);

	if (!server || !server.aes_key) {
		response.status(200).send(nascError('110').toString());
		return;
	}

	if (server.maintenance_mode) {
		// TODO - FIND THE REAL UNDER MAINTENANCE ERROR CODE. 110 IS NOT IT
		response.status(200).send(nascError('110').toString());
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
			responseData = await processLoginRequest(server, nexAccount.pid, titleID);
			break;
		case 'SVCLOC':
			responseData = await processServiceTokenRequest(server, nexAccount.pid, titleID);
			break;
	}

	response.status(200).send(responseData.toString());
});

async function processLoginRequest(server: HydratedServerDocument, pid: number, titleID: string): Promise<URLSearchParams> {
	const tokenOptions = {
		system_type: 0x2, // * 3DS
		token_type: 0x3, // * NEX token
		pid: pid,
		access_level: 0,
		title_id: BigInt(parseInt(titleID, 16)),
		expire_time: BigInt(Date.now() + (3600 * 1000))
	};

	// TODO - Handle null tokens

	const nexTokenBuffer = await generateToken(server.aes_key, tokenOptions);
	const nexToken = nintendoBase64Encode(nexTokenBuffer || '');

	return new URLSearchParams({
		locator: nintendoBase64Encode(`${server.ip}:${server.port}`),
		retry: nintendoBase64Encode('0'),
		returncd: nintendoBase64Encode('001'),
		token: nexToken,
		datetime: nintendoBase64Encode(nascDateTime())
	});
}

async function processServiceTokenRequest(server: HydratedServerDocument, pid: number, titleID: string): Promise<URLSearchParams> {
	const tokenOptions = {
		system_type: 0x2, // * 3DS
		token_type: 0x4, // * Service token
		pid: pid,
		access_level: 0,
		title_id: BigInt(parseInt(titleID, 16)),
		expire_time: BigInt(Date.now() + (3600 * 1000))
	};

	// TODO - Handle null tokens

	const serviceTokenBuffer = await generateToken(server.aes_key, tokenOptions);
	const serviceToken = nintendoBase64Encode(serviceTokenBuffer || '');

	return new URLSearchParams({
		retry: nintendoBase64Encode('0'),
		returncd: nintendoBase64Encode('007'),
		servicetoken: serviceToken,
		statusdata: nintendoBase64Encode('Y'),
		svchost: nintendoBase64Encode('n/a'),
		datetime: nintendoBase64Encode(nascDateTime())
	});
}

export default router;
