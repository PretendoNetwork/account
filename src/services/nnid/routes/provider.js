const router = require('express').Router();
const xmlbuilder = require('xmlbuilder');
const fs = require('fs-extra');
const { NEXAccount } = require('../../../models/nex-account');
const util = require('../../../util');
const database = require('../../../database');

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/provider/service_token/@me
 * Description: Gets a service token
 */
router.get('/service_token/@me', async (request, response) => {
	const { pnid } = request;

	const titleId = request.headers['x-nintendo-title-id'];
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

	const { service_name, service_type, device } = server;

	const cryptoPath = `${__dirname}/../../../../certs/${service_type}/${service_name}`;

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

	let publicKey = cache.getServicePublicKey(service_name);
	if (publicKey === null) {
		publicKey = await fs.readFile(`${cryptoPath}/public.pem`);
		await cache.setServicePublicKey(service_name, publicKey);
	}

	let secretKey = cache.getServiceSecretKey(service_name);
	if (secretKey === null) {
		secretKey = await fs.readFile(`${cryptoPath}/secret.key`);
		await cache.setServiceSecretKey(service_name, secretKey);
	}

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

	const { service_name, service_type, ip, port, device } = server;
	const titleId = request.headers['x-nintendo-title-id'];

	const cryptoPath = `${__dirname}/../../../../certs/${service_type}/${service_name}`;
	
	if (!fs.pathExistsSync(cryptoPath)) {
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

	const publicKey = fs.readFileSync(`${cryptoPath}/public.pem`);
	const hmacSecret = fs.readFileSync(`${cryptoPath}/secret.key`);

	const cryptoOptions = {
		public_key: publicKey,
		hmac_secret: hmacSecret
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

module.exports = router;