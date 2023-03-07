import express from 'express';
import xmlbuilder from 'xmlbuilder';
import fs from 'fs-extra';
import database from '@/database';
import util from '@/util';
import cache from '@/cache';
import { NEXAccount } from '@/models/nex-account';
import { CryptoOptions } from '@/types/common/crypto-options';
import { TokenOptions } from '@/types/common/token-options';
import { HydratedPNIDDocument } from '@/types/mongoose/pnid';
import { HydratedServerDocument } from '@/types/mongoose/server';
import { HydratedNEXAccountDocument } from '@/types/mongoose/nex-account';

const router: express.Router = express.Router();

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/provider/service_token/@me
 * Description: Gets a service token
 */
router.get('/service_token/@me', async (request: express.Request, response: express.Response) => {
	const pnid: HydratedPNIDDocument = request.pnid;

	const titleId: string = request.headers['x-nintendo-title-id'] as string;
	const serverAccessLevel: string = pnid.get('server_access_level');
	const server: HydratedServerDocument = await database.getServerByTitleId(titleId, serverAccessLevel);

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

	const serverName: string = server.service_name;
	const device: number = server.device;

	const cryptoPath: string = `${__dirname}/../../../../certs/service/${serverName}`;

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

	const publicKey: Buffer = await cache.getServicePublicKey(serverName);
	const secretKey: Buffer = await cache.getServiceSecretKey(serverName);

	const cryptoOptions: CryptoOptions = {
		public_key: publicKey,
		hmac_secret: secretKey
	};

	const tokenOptions: TokenOptions = {
		system_type: device,
		token_type: 0x4, // service token,
		pid: pnid.get('pid'),
		access_level: pnid.get('access_level'),
		title_id: BigInt(parseInt(titleId, 16)),
		expire_time: BigInt(Date.now() + (3600 * 1000))
	};

	let serviceToken: string = await util.generateToken(cryptoOptions, tokenOptions);

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
router.get('/nex_token/@me', async (request: express.Request, response: express.Response) => {
	const pnid: HydratedPNIDDocument = request.pnid;
	const gameServerID: string = request.query.game_server_id as string;

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

	const serverAccessLevel: string = pnid.get('server_access_level');
	const server: HydratedServerDocument = await database.getServer(gameServerID, serverAccessLevel);

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

	const serverName: string = server.service_name;
	const ip: string = server.ip;
	const port: number = server.port;
	const device: number = server.device;
	const titleId: string = request.headers['x-nintendo-title-id'] as string;

	const cryptoPath: string = `${__dirname}/../../../../certs/nex/${serverName}`;

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

	const publicKey: Buffer = await cache.getNEXPublicKey(serverName);
	const secretKey: Buffer = await cache.getNEXSecretKey(serverName);

	const cryptoOptions: CryptoOptions = {
		public_key: publicKey,
		hmac_secret: secretKey
	};

	const tokenOptions: TokenOptions = {
		system_type: device,
		token_type: 0x3, // nex token,
		pid: pnid.get('pid'),
		access_level: pnid.get('access_level'),
		title_id: BigInt(parseInt(titleId, 16)),
		expire_time: BigInt(Date.now() + (3600 * 1000))
	};

	const nexUser: HydratedNEXAccountDocument = await NEXAccount.findOne({
		owning_pid: pnid.get('pid')
	});

	if (!nexUser) {
		response.status(404);
		return response.send('<errors><error><cause/><code>0008</code><message>Not Found</message></error></errors>');
	}

	let nexToken: string = await util.generateToken(cryptoOptions, tokenOptions);

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