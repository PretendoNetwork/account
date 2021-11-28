const crypto = require('crypto');
const fs = require('fs');
const router = require('express').Router();
const { Device } = require('../../../models/device');
const { NEXAccount } = require('../../../models/nex-account');
const util = require('../../../util');
const servers = require('../../../servers.json');

router.post('/', async (request, response) => {
	const requestParams = request.body;
	const titleID = util.nintendoBase64Decode(requestParams.titleid);
	const action = util.nintendoBase64Decode(requestParams.action);
	let pid;

	if (action === 'LOGIN') {
		if (titleID === '0004013000003202') {
			if (requestParams.passwd && !requestParams.userid && !requestParams.uidhmac) {
				// Initial setup request
				const deviceDocument = {
					is_emulator: false, // TODO: Check this for real
					console_type: 'ctr', // TODO: Check serial number
					device_id: 0,
					device_type: 0,
					serial: String,
					device_attributes: [],
					soap: {},
					mac_hash: crypto.createHash('sha256').update(requestParams.macadr).digest('base64'),
					fcdcert_hash: crypto.createHash('sha256').update(util.nintendoBase64Decode(requestParams.fcdcert)).digest('base64')
				};

				// Store device data
				const newDevice = new Device(deviceDocument);
				await newDevice.save();

				// Create new NEX account
				const newNEXAccount = new NEXAccount({
					pid: 0,
					password: '',
					owning_pid: 0,
				});
				await newNEXAccount.save();

				// Set password
				await NEXAccount.updateOne({ pid: newNEXAccount.get('pid') }, { password: util.nintendoBase64Decode(requestParams.passwd) });

				pid = newNEXAccount.get('pid');
			}
		}

		if (requestParams.userid) {
			pid = Number(util.nintendoBase64Decode(requestParams.userid));
		}

		const server = servers.find(({ server_id }) => server_id === titleID);

		const { name, ip, port } = server;

		const cryptoPath = `${__dirname}/../../../../certs/nex/${name}`;

		const publicKey = fs.readFileSync(`${cryptoPath}/public.pem`);
		const hmacSecret = fs.readFileSync(`${cryptoPath}/secret.key`);

		const cryptoOptions = {
			public_key: publicKey,
			hmac_secret: hmacSecret
		};

		const tokenOptions = {
			system_type: 0x2, // 3DS
			token_type: 0x3, // nex token,
			pid: pid,
			access_level: 0,
			title_id: BigInt(parseInt(titleID, 16)),
			date: BigInt(Date.now())
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
	}
});

module.exports = router;