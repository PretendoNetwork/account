import crypto from 'node:crypto';
import express from 'express';
import xmlbuilder from 'xmlbuilder';
import { BanTargetType, BanScopeType } from '@pretendonetwork/grpc/account/v2/ban_details';
import { getActiveBan, getServerByClientID, getServerByGameServerID } from '@/database';
import { getNNASBanError } from '@/services/nnas/ban-errors';
import { createServiceToken, getValueFromHeaders, getValueFromQueryString } from '@/util';
import { TokenType } from '@/types/common/token-types';
import { IndependentServiceToken } from '@/models/independent-service-token';
import { NEXToken } from '@/models/nex-token';
import { NEXAccount } from '@/models/nex-account';

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

	// TODO - Once https://github.com/PretendoNetwork/account/issues/202 merges this needs to be updated to let 3rd parties opt-out of respecting our bans if they want to handle it themselves
	const ban = await getActiveBan(BanTargetType.BAN_TARGET_TYPE_NETWORK_ACCOUNT, [
		pnid.pid.toString()
	], [
		{
			type: BanScopeType.BAN_SCOPE_TYPE_INDEPENDENT_SERVICE,
			target: clientID
		}
	]);

	if (ban) {
		const banError = getNNASBanError(ban);

		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					code: banError.code,
					message: banError.message
				}
			}
		}).end());

		return;
	}

	const serviceTokenOptions = {
		pid: pnid.pid,
		title_id: titleID,
		issued: new Date(),
		expires: new Date(Date.now() + 24 * 3600 * 1000)
	};

	const token = createServiceToken(server, serviceTokenOptions).toString('base64');

	await IndependentServiceToken.create({
		token: crypto.createHash('sha256').update(token).digest('hex'),
		client_id: clientID,
		title_id: serviceTokenOptions.title_id,
		pid: serviceTokenOptions.pid,
		info: {
			system_type: server.device,
			token_type: TokenType.IndependentService,
			title_id: BigInt(parseInt(titleID, 16)),
			issued: serviceTokenOptions.issued,
			expires: serviceTokenOptions.expires
		}
	});

	response.send(xmlbuilder.create({
		service_token: {
			token: token
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

	const banScopes = [
		{
			type: BanScopeType.BAN_SCOPE_TYPE_NEX_SERVICE,
			target: server.game_server_id
		}
	];

	const accountBan = await getActiveBan(BanTargetType.BAN_TARGET_TYPE_NETWORK_ACCOUNT, [
		pnid.pid.toString()
	], banScopes);

	const nexAccountBan = await getActiveBan(BanTargetType.BAN_TARGET_TYPE_NEX_ACCOUNT, [
		nexAccount.pid.toString()
	], banScopes);

	const ban = accountBan || nexAccountBan;

	if (ban) {
		const banError = getNNASBanError(ban);

		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					code: banError.code,
					message: banError.message
				}
			}
		}).end());

		return;
	}

	const token = crypto.randomBytes(36).toString('base64');

	await NEXToken.create({
		token: crypto.createHash('sha256').update(token).digest('hex'),
		game_server_id: gameServerID,
		pid: pnid.pid,
		info: {
			system_type: server.device,
			token_type: TokenType.NEX,
			title_id: BigInt(parseInt(titleID, 16)),
			issued: new Date(),
			expires: new Date(Date.now() + (3600 * 1000))
		}
	});

	const connectInfo = await server.getServerConnectInfo();
	response.send(xmlbuilder.create({
		nex_token: {
			host: connectInfo.ip,
			nex_password: nexAccount.password,
			pid: nexAccount.pid,
			port: connectInfo.port,
			token: token
		}
	}).end());
});

export default router;
