import express from 'express';
import xmlbuilder from 'xmlbuilder';
import { getServerByClientID, getServerByGameServerID } from '@/database';
import { generateToken, getValueFromHeaders, getValueFromQueryString } from '@/util';
import { NEXAccount } from '@/models/nex-account';
import { TokenOptions } from '@/types/common/token';
import { serverDeviceToSystemType } from '@/types/common/token';

const router = express.Router();

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/provider/service_token/@me
 * Description: Gets a service token
 */
router.get('/service_token/@me', async (request: express.Request, response: express.Response): Promise<void> => {
	const pnid = request.pnid;

	if (!pnid) {
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'access_token',
					code: '0002',
					message: 'Invalid access token'
				}
			}
		}).end());

		return;
	}

	const clientID = getValueFromQueryString(request.query, 'client_id');

	if (!clientID) {
		// TODO - Research this error more
		response.send(xmlbuilder.create({
			errors: {
				error: {
					code: '1021',
					message: 'The requested game server was not found'
				}
			}
		}).end());

		return;
	}

	const titleID = getValueFromHeaders(request.headers, 'x-nintendo-title-id');

	if (!titleID) {
		// TODO - Research this error more
		response.send(xmlbuilder.create({
			errors: {
				error: {
					code: '1021',
					message: 'The requested game server was not found'
				}
			}
		}).end());

		return;
	}

	const serverAccessLevel = pnid.server_access_level;
	const server = await getServerByClientID(clientID, serverAccessLevel);

	if (!server || !server.aes_key) {
		response.send(xmlbuilder.create({
			errors: {
				error: {
					code: '1021',
					message: 'The requested game server was not found'
				}
			}
		}).end());

		return;
	}

	if (server.maintenance_mode) {
		response.send(xmlbuilder.create({
			errors: {
				error: {
					code: '2002',
					message: 'The requested game server is under maintenance'
				}
			}
		}).end());

		return;
	}

	const systemType = serverDeviceToSystemType[server.device];
	if (!systemType) {
		response.send(xmlbuilder.create({
			errors: {
				error: {
					code: '1021',
					message: 'The requested game server was not found'
				}
			}
		}).end());
	}

	const tokenOptions: TokenOptions = {
		system_type: systemType,
		token_type: 'SERVICE',
		pid: pnid.pid,
		access_level: pnid.access_level,
		title_id: BigInt(parseInt(titleID, 16)),
		expire_time: BigInt(Date.now() + (3600 * 1000))
	};

	const serviceTokenBuffer = generateToken(server.aes_key, tokenOptions);
	let serviceToken = serviceTokenBuffer ? serviceTokenBuffer.toString('base64') : '';

	if (request.isCemu) {
		serviceToken = Buffer.from(serviceToken, 'base64').toString('hex');
	}

	response.send(xmlbuilder.create({
		service_token: {
			token: serviceToken
		}
	}).end());
});

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/provider/nex_token/@me
 * Description: Gets a NEX server address and token
 */
router.get('/nex_token/@me', async (request: express.Request, response: express.Response): Promise<void> => {
	const pnid = request.pnid;

	if (!pnid) {
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'access_token',
					code: '0002',
					message: 'Invalid access token'
				}
			}
		}).end());

		return;
	}

	const nexAccount = await NEXAccount.findOne({
		owning_pid: pnid.pid
	});

	if (!nexAccount) {
		response.status(404).send(xmlbuilder.create({
			errors: {
				error: {
					cause: '',
					code: '0008',
					message: 'Not Found'
				}
			}
		}).end());

		return;
	}

	const gameServerID = getValueFromQueryString(request.query, 'game_server_id');

	if (!gameServerID) {
		response.send(xmlbuilder.create({
			errors: {
				error: {
					code: '0118',
					message: 'Unique ID and Game Server ID are not linked'
				}
			}
		}).end());

		return;
	}

	const serverAccessLevel = pnid.server_access_level;
	const server = await getServerByGameServerID(gameServerID, serverAccessLevel);

	if (!server || !server.aes_key) {
		response.send(xmlbuilder.create({
			errors: {
				error: {
					code: '1021',
					message: 'The requested game server was not found'
				}
			}
		}).end());

		return;
	}

	if (server.maintenance_mode) {
		response.send(xmlbuilder.create({
			errors: {
				error: {
					code: '2002',
					message: 'The requested game server is under maintenance'
				}
			}
		}).end());

		return;
	}

	const titleID = getValueFromHeaders(request.headers, 'x-nintendo-title-id');

	if (!titleID) {
		// TODO - Research this error more
		response.send(xmlbuilder.create({
			errors: {
				error: {
					code: '1021',
					message: 'The requested game server was not found'
				}
			}
		}).end());

		return;
	}

	const systemType = serverDeviceToSystemType[server.device];
	if (!systemType) {
		response.send(xmlbuilder.create({
			errors: {
				error: {
					code: '1021',
					message: 'The requested game server was not found'
				}
			}
		}).end());
	}

	const tokenOptions: TokenOptions = {
		system_type: systemType,
		token_type: 'NEX',
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

	response.send(xmlbuilder.create({
		nex_token: {
			host: server.ip,
			nex_password: nexAccount.password,
			pid: nexAccount.pid,
			port: server.port,
			token: nexToken
		}
	}).end());
});

export default router;