import { Router } from 'express';
import xmlbuilder from 'xmlbuilder';
import fs from 'fs-extra';
import database from '@database';
import util from '@util';
import cache from '@cache';
import { NEXAccount } from '@models/nex-account';

const router = Router();

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/provider/service_token/@me
 * Description: Gets a service token
 */
router.get('/service_token/@me', async (request, response) => {
	const { pnid } = request;

	const titleId = request.headers['x-nintendo-title-id'] as string;
	const serverAccessLevel = pnid.get('server_access_level');
	const server = await database.getServerByTitleId(titleId, serverAccessLevel);

	if (!server) {
		return response.send(xmlbuilder.create({
			errors: {
				error: {
					code: '1021',
					message: 'The requested game server was not found'
				}
			}
		}).end());
	}

	const { service_name, device } = server;

	const cryptoPath = `${__dirname}/../../../../certs/service/${service_name}`;

	if (!await fs.pathExists(cryptoPath)) {
		// Need to generate keys
		return response.send(xmlbuilder.create({
			errors: {
				error: {
					code: '1021',
					message: 'The requested game server was not found'
				}
			}
		}).end());
	}

	const publicKey = await cache.getServicePublicKey(service_name);
	const secretKey = await cache.getServiceSecretKey(service_name);

	const cryptoOptions = {
		public_key: publicKey,
		hmac_secret: secretKey
	};

	const tokenOptions = {
		system_type: device,
		token_type: 0x4, // service token,
		pid: pnid.get('pid'),
		access_level: pnid.get('access_level'),
		title_id: BigInt(parseInt(titleId, 16)),
		expire_time: BigInt(Date.now() + (3600 * 1000))
	};

	let serviceToken = await util.generateToken(cryptoOptions, tokenOptions);

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
router.get('/nex_token/@me', async (request, response) => {
	const { game_server_id: gameServerID } = request.query;
	const { pnid } = request;

	if (!gameServerID) {
		return response.send(xmlbuilder.create({
			errors: {
				error: {
					code: '0118',
					message: 'Unique ID and Game Server ID are not linked'
				}
			}
		}).end());
	}

	const serverAccessLevel = pnid.get('server_access_level');
	const server = await database.getServer(gameServerID, serverAccessLevel);

	if (!server) {
		return response.send(xmlbuilder.create({
			errors: {
				error: {
					code: '1021',
					message: 'The requested game server was not found'
				}
			}
		}).end());
	}

	const { service_name, ip, port, device } = server;
	const titleId = request.headers['x-nintendo-title-id'] as string;

	const cryptoPath = `${__dirname}/../../../../certs/nex/${service_name}`;

	if (!await fs.pathExists(cryptoPath)) {
		// Need to generate keys
		return response.send(xmlbuilder.create({
			errors: {
				error: {
					code: '1021',
					message: 'The requested game server was not found'
				}
			}
		}).end());
	}

	const publicKey = await cache.getNEXPublicKey(service_name);
	const secretKey= await cache.getNEXSecretKey(service_name);

	const cryptoOptions = {
		public_key: publicKey,
		hmac_secret: secretKey
	};

	const tokenOptions = {
		system_type: device,
		token_type: 0x3, // nex token,
		pid: pnid.get('pid'),
		access_level: pnid.get('access_level'),
		title_id: BigInt(parseInt(titleId, 16)),
		expire_time: BigInt(Date.now() + (3600 * 1000))
	};

	const nexUser = await NEXAccount.findOne({
		owning_pid: pnid.get('pid')
	});

	if (!nexUser) {
		response.status(404);
		return response.send('<errors><error><cause/><code>0008</code><message>Not Found</message></error></errors>');
	}

	let nexToken = await util.generateToken(cryptoOptions, tokenOptions);

	if (request.isCemu) {
		nexToken = Buffer.from(nexToken, 'base64').toString('hex');
	}

	response.send(xmlbuilder.create({
		nex_token: {
			host: ip,
			nex_password: nexUser.get('password'),
			pid: nexUser.get('pid'),
			port: port,
			token: nexToken
		}
	}).end());
});

export default router;