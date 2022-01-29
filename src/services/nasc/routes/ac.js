const fs = require('fs');
const router = require('express').Router();
const util = require('../../../util');
const database = require('../../../database');

router.post('/', async (request, response) => {
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
		return util.nascError(response, '110');
	}

	const { service_name, ip, port } = server;

	const cryptoPath = `${__dirname}/../../../../certs/nex/${service_name}`;

	const publicKey = fs.readFileSync(`${cryptoPath}/public.pem`);
	const hmacSecret = fs.readFileSync(`${cryptoPath}/secret.key`);

	const cryptoOptions = {
		public_key: publicKey,
		hmac_secret: hmacSecret
	};

	const tokenOptions = {
		system_type: 0x2, // 3DS
		token_type: 0x3, // nex token,
		pid: nexUser.get('pid'),
		access_level: 0,
		title_id: BigInt(parseInt(titleID, 16)),
		expire_time: BigInt(Date.now() + (3600 * 1000))
	};

	let nexToken = util.generateToken(cryptoOptions, tokenOptions);
	nexToken = util.nintendoBase64Encode(Buffer.from(nexToken, 'base64'));

	const params = new URLSearchParams({
		locator: util.nintendoBase64Encode(`${ip}:${port}`),
		retry: util.nintendoBase64Encode('0'),
		returncd: util.nintendoBase64Encode('001'),
		token: nexToken,
		datetime: util.nintendoBase64Encode(Date.now().toString()),
	});

	response.status(200).send(params.toString());
});

module.exports = router;