const fs = require('fs-extra');
const express = require('express');
const util = require('../../../util');
const database = require('../../../database');
const cache = require('../../../cache');

const router = express.Router();

/**
 * [POST]
 * Replacement for: https://nasc.nintendowifi.net/ac
 * Description: Gets a NEX server address and token
 */
router.post('/', async (request, response) => {
	const requestParams = request.body;
	const action = util.nintendoBase64Decode(requestParams.action).toString();
	let responseData;

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


/**
 * 
 * @param {express.Request} request
 */
async function processLoginRequest(request) {
	const requestParams = request.body;
	const titleID = util.nintendoBase64Decode(requestParams.titleid).toString();
	const { nexUser } = request;

	// TODO: REMOVE AFTER PUBLIC LAUNCH
	// LET EVERYONE IN THE `test` FRIENDS SERVER
	// THAT WAY EVERYONE CAN GET AN ASSIGNED PID
	let serverAccessLevel = 'test';
	if (titleID !== '0004013000003202') {
		serverAccessLevel = nexUser.get('server_access_level');
	}

	const server = await database.getServerByTitleId(titleID, serverAccessLevel);

	if (!server || !server.service_name || !server.ip || !server.port) {
		return util.nascError('110');
	}

	const { service_name, ip, port } = server;

	const cryptoPath = `${__dirname}/../../../../certs/nex/${service_name}`;

	let publicKey= await cache.getNEXPublicKey(service_name);
	if (publicKey === null) {
		publicKey = await fs.readFile(`${cryptoPath}/public.pem`);
		await cache.setNEXPublicKey(service_name, publicKey);
	}

	let secretKey= await cache.getNEXSecretKey(service_name);
	if (secretKey === null) {
		secretKey = await fs.readFile(`${cryptoPath}/secret.key`);
		await cache.setNEXSecretKey(service_name, secretKey);
	}

	const cryptoOptions = {
		public_key: publicKey,
		hmac_secret: secretKey
	};

	const tokenOptions = {
		system_type: 0x2, // 3DS
		token_type: 0x3, // nex token,
		pid: nexUser.get('pid'),
		access_level: 0,
		title_id: BigInt(parseInt(titleID, 16)),
		expire_time: BigInt(Date.now() + (3600 * 1000))
	};

	let nexToken = await util.generateToken(cryptoOptions, tokenOptions);
	nexToken = util.nintendoBase64Encode(Buffer.from(nexToken, 'base64'));

	const params = new URLSearchParams({
		locator: util.nintendoBase64Encode(`${ip}:${port}`),
		retry: util.nintendoBase64Encode('0'),
		returncd: util.nintendoBase64Encode('001'),
		token: nexToken,
		datetime: util.nintendoBase64Encode(Date.now().toString()),
	});

	return params;
}

/**
 * 
 * @param {express.Request} request
 */
async function processServiceTokenRequest(request) {
	const params = new URLSearchParams({
		retry: util.nintendoBase64Encode('0'),
		returncd: util.nintendoBase64Encode('007'),
		servicetoken: util.nintendoBase64Encode(Buffer.alloc(64).toString()), // hard coded for now
		statusdata: util.nintendoBase64Encode('Y'),
		svchost: util.nintendoBase64Encode('n/a'),
		datetime: util.nintendoBase64Encode(Date.now().toString()),
	});

	return params;
}

module.exports = router;