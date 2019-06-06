const router = require('express').Router();
const json2xml = require('json2xml');
const crypto = require('../helpers/crypto');
const nintendoClientHeaderCheck = require('../middleware/nintendoClientHeaderCheck');

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/provider/service_token/@me
 * Description: Gets a service token
 */
router.get('/service_token/@me', nintendoClientHeaderCheck, async (request, response) => {
	const serviceToken = crypto.signServiceToken(request.pnid.get('pid'));

	response.send(json2xml({
		service_token: {
			token: serviceToken
		}
	}));
});

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/provider/nex_token/@me
 * Description: Gets a NEX server address and token
 */
router.get('/nex_token/@me', nintendoClientHeaderCheck, async (request, response) => {
	const {game_server_id: gameServerID} = request.query;

	if (!gameServerID) {
		return response.send(json2xml({
			errors: {
				error: {
					code: '0118',
					message: 'Unique ID and Game Server ID are not linked'
				}
			}
		}));
	}

	const [ip, port] = await request.database.getNEXServerAddress(gameServerID);

	if (!ip || !port) {
		return response.send(json2xml({
			errors: {
				error: {
					code: '1021',
					message: 'The requested game server was not found'
				}
			}
		}));
	}

	const NEXToken = crypto.signServiceToken(request.pnid.get('pid')); // temp. we need to change this to make real nex tokens
	response.send(json2xml({
		nex_token: {
			host: ip,
			nex_password: request.pnid.get('nex.password'),
			pid: request.pnid.get('pid'),
			port: port,
			token: NEXToken
		}
	}));
});

module.exports = router;