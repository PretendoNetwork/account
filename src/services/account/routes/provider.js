const router = require('express').Router();
const xmlbuilder = require('xmlbuilder');
const fs = require('fs-extra');
const util = require('../../../util');
const servers = require('../../../servers.json');

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/provider/service_token/@me
 * Description: Gets a service token
 */
router.get('/service_token/@me', async (request, response) => {
	const { pnid } = request;

	const titleId = request.headers['x-nintendo-title-id'];
	const server = servers.find(({ title_ids }) => title_ids.includes(titleId));

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

	const { name, system } = server;

	const cryptoPath = `${__dirname}/../../../../certs/nex/${name}`;

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
		system_type: system,
		token_type: 0x4, // service token,
		pid: pnid.get('pid'),
		title_id: BigInt(parseInt(titleId, 16)),
		date: BigInt(Date.now())
	};

	const serviceToken = util.generateToken(cryptoOptions, tokenOptions);

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

	const server = servers.find(({ server_id }) => server_id === gameServerID);

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

	const { name, ip, port, system } = server;
	const titleId = request.headers['x-nintendo-title-id'];

	const cryptoPath = `${__dirname}/../../../../certs/nex/${name}`;
	
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
		system_type: system,
		token_type: 0x3, // nex token,
		pid: pnid.get('pid'),
		title_id: BigInt(parseInt(titleId, 16)),
		date: BigInt(Date.now())
	};

	const nexToken = util.generateToken(cryptoOptions, tokenOptions);

	response.send(xmlbuilder.create({
		nex_token: {
			host: ip,
			nex_password: pnid.get('nex.password'),
			pid: pnid.get('pid'),
			port: port,
			token: nexToken
		}
	}).end());
});

module.exports = router;