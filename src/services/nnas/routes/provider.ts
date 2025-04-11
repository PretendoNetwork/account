import express from 'express';
import { getServerByClientID, getServerByGameServerID } from '@/database';
import { generateToken, getValueFromHeaders, getValueFromQueryString, isSystemType } from '@/util';
import { createNNASErrorResponse, createNNASResponse } from '@/services/nnas/create-response';
import { NEXAccount } from '@/models/nex-account';
import { SystemType, TokenOptions, TokenType } from '@/types/common/token';

const router = express.Router();

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/provider/service_token/@me
 * Description: Gets a service token
 */
router.get('/service_token/@me', async (request: express.Request, response: express.Response): Promise<void> => {
	const pnid = request.pnid;

	if (!pnid) {
		return createNNASErrorResponse(response, {
			errors: [
				{
					cause: 'access_token',
					code: '0002',
					message: 'Invalid access token'
				}
			]
		});
	}

	const clientID = getValueFromQueryString(request.query, 'client_id');

	if (!clientID) {
		// TODO - Research this error more
		return createNNASErrorResponse(response, {
			errors: [
				{
					code: '1021',
					message: 'The requested game server was not found'
				}
			]
		});
	}

	const titleID = getValueFromHeaders(request.headers, 'x-nintendo-title-id');

	if (!titleID) {
		// TODO - Research this error more
		return createNNASErrorResponse(response, {
			errors: [
				{
					code: '1021',
					message: 'The requested game server was not found'
				}
			]
		});
	}

	const serverAccessLevel = pnid.server_access_level;
	const server = await getServerByClientID(clientID, serverAccessLevel);

	if (!server || !server.aes_key) {
		return createNNASErrorResponse(response, {
			errors: [
				{
					code: '1021',
					message: 'The requested game server was not found'
				}
			]
		});
	}

	if (server.maintenance_mode) {
		return createNNASErrorResponse(response, {
			errors: [
				{
					code: '2002',
					message: 'The requested game server is under maintenance'
				}
			]
		});
	}

	if (!isSystemType(server.device)) {
		throw new Error('Invalid system type');
	}

	// * Asserted safely because of the check above
	const systemType = server.device as SystemType;

	const tokenOptions: TokenOptions = {
		system_type: systemType as SystemType,
		token_type: TokenType.SERVICE,
		pid: pnid.pid,
		access_level: pnid.access_level,
		title_id: BigInt(parseInt(titleID, 16)),
		expire_time: BigInt(Date.now() + (3600 * 1000))
	};

	const serviceTokenBuffer = generateToken(server.aes_key, tokenOptions);
	const serviceToken = request.isCemu ? serviceTokenBuffer.toString('hex') : serviceTokenBuffer.toString('base64');

	return createNNASResponse(response, {
		body: {
			service_token: {
				token: serviceToken
			}
		}
	});
});

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/provider/nex_token/@me
 * Description: Gets a NEX server address and token
 */
router.get('/nex_token/@me', async (request: express.Request, response: express.Response): Promise<void> => {
	const pnid = request.pnid;

	if (!pnid) {
		return createNNASErrorResponse(response, {
			errors: [
				{
					cause: 'access_token',
					code: '0002',
					message: 'Invalid access token'
				}
			]
		});
	}

	const nexAccount = await NEXAccount.findOne({
		owning_pid: pnid.pid
	});

	if (!nexAccount) {
		return createNNASErrorResponse(response, {
			status: 404,
			errors: [
				{
					cause: '',
					code: '0008',
					message: 'Not Found'
				}
			]
		});
	}

	const gameServerID = getValueFromQueryString(request.query, 'game_server_id');

	if (!gameServerID) {
		return createNNASErrorResponse(response, {
			errors: [
				{
					code: '0118',
					message: 'Unique ID and Game Server ID are not linked'
				}
			]
		});
	}

	const serverAccessLevel = pnid.server_access_level;
	const server = await getServerByGameServerID(gameServerID, serverAccessLevel);

	if (!server || !server.aes_key) {
		return createNNASErrorResponse(response, {
			errors: [
				{
					code: '1021',
					message: 'The requested game server was not found'
				}
			]
		});
	}

	if (server.maintenance_mode) {
		return createNNASErrorResponse(response, {
			errors: [
				{
					code: '2002',
					message: 'The requested game server is under maintenance'
				}
			]
		});
	}

	const titleID = getValueFromHeaders(request.headers, 'x-nintendo-title-id');

	if (!titleID) {
		// TODO - Research this error more
		return createNNASErrorResponse(response, {
			errors: [
				{
					code: '1021',
					message: 'The requested game server was not found'
				}
			]
		});
	}

	if (!isSystemType(server.device)) {
		throw new Error('Invalid system type');
	}

	// * Asserted safely because of the check above
	const systemType = server.device as SystemType;

	const tokenOptions: TokenOptions = {
		system_type: systemType, 
		token_type: TokenType.NEX,
		pid: pnid.pid,
		access_level: pnid.access_level,
		title_id: BigInt(parseInt(titleID, 16)),
		expire_time: BigInt(Date.now() + (3600 * 1000))
	};

	const nexTokenBuffer = generateToken(server.aes_key, tokenOptions);
	let nexToken = nexTokenBuffer ? nexTokenBuffer.toString('base64') : '';

	if (request.isCemu) {
		nexToken = Buffer.from(nexToken || '', 'base64').toString('hex');
	}

	return createNNASResponse(response, {
		body: {
			nex_token: {
				host: server.ip,
				nex_password: nexAccount.password,
				pid: nexAccount.pid,
				port: server.port,
				token: nexToken
			}
		}
	});
});

export default router;