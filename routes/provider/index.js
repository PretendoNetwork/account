const routes = require('express').Router();
const json2xml = require('json2xml');
const jwt = require('jsonwebtoken');
const debug = require('../../debugger');
const config = require('../../config');
const constants = require('../../constants');
const helpers = require('../../helpers');
const route_debugger = new debug('Provider Route'.green);
const gamePort = require('../../config.json').nex_servers;

route_debugger.log('Loading \'provider\' API routes');

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/provider/service_token/@me
 * Description: Gets service token
 */
routes.get('/service_token/@me', async (request, response) => {
	response.set('Content-Type', 'text/xml');
	response.set('Server', 'Nintendo 3DS (http)');
	response.set('X-Nintendo-Date', new Date().getTime());

	const headers = request.headers;

	if (
		!headers['x-nintendo-client-id'] ||
		!headers['x-nintendo-client-secret'] ||
		!constants.VALID_CLIENT_ID_SECRET_PAIRS[headers['x-nintendo-client-id']] ||
		headers['x-nintendo-client-secret'] !== constants.VALID_CLIENT_ID_SECRET_PAIRS[headers['x-nintendo-client-id']]
	) {
		const error = {
			errors: {
				error: {
					cause: 'client_id',
					code: '0004',
					message: 'API application invalid or incorrect application credentials'
				}
			}
		};

		return response.send(json2xml(error));
	}

	if (
		!headers['authorization']
	) {
		const error = {
			errors: {
				error: {
					cause: 'access_token',
					code: '0002',
					message: 'Invalid access token'
				}
			}
		};

		return response.send(json2xml(error));
	}
	
	const user = await helpers.getUser(headers['authorization'].replace('Bearer ',''));

	if (!user) {
		const error = {
			errors: {
				error: {
					cause: 'access_token',
					code: '0002',
					message: 'Invalid access token'
				}
			}
		};

		return response.send(json2xml(error));
	}
	
	delete user.sensitive;

	const token = {
		service_token: {
			token: jwt.sign({
				data: {
					type: 'service_token',
					payload: user
				}
			}, {
				key: config.JWT.SERVICE.PRIVATE,
				passphrase: config.JWT.SERVICE.PASSPHRASE
			}, { algorithm: 'RS256'})
		}
	};

	return response.send(json2xml(token));
});

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/provider/nex_token/@me
 * Description: Gets nex token
 */
routes.get('/nex_token/@me', async (request, response) => {
	response.set('Content-Type', 'text/xml');
	response.set('Server', 'Nintendo 3DS (http)');
	response.set('X-Nintendo-Date', new Date().getTime());

	const headers = request.headers;

	if (
		!headers['x-nintendo-client-id'] ||
		!headers['x-nintendo-client-secret'] ||
		!constants.VALID_CLIENT_ID_SECRET_PAIRS[headers['x-nintendo-client-id']] ||
		headers['x-nintendo-client-secret'] !== constants.VALID_CLIENT_ID_SECRET_PAIRS[headers['x-nintendo-client-id']]
	) {
		const error = {
			errors: {
				error: {
					cause: 'client_id',
					code: '0004',
					message: 'API application invalid or incorrect application credentials'
				}
			}
		};

		return response.send(json2xml(error));
	}

	if (
		!headers['authorization']
	) {
		const error = {
			errors: {
				error: {
					cause: 'access_token',
					code: '0002',
					message: 'Invalid access token'
				}
			}
		};

		return response.send(json2xml(error));
	}
	
	const user = await helpers.getUser(headers['authorization'].replace('Bearer ',''));

	if (!user) {
		const error = {
			errors: {
				error: {
					cause: 'access_token',
					code: '0002',
					message: 'Invalid access token'
				}
			}
		};

		return response.send(json2xml(error));
	}

	const nex_password = user.sensitive.nex_password;
	delete user.sensitive;
	
	let ip = null;
	let port = null;
	
	switch(request.query.game_server_id){
		case '00003200':
			ip = gamePort.friends.ip;
			port = gamePort.friends.port;
			break;
		case '1018DB00':
			ip = gamePort.supermariomaker.ip;
			port = gamePort.supermariomaker.port;
			break;
		default:
			ip = null;
			port = null;
			break;
	}
	
	if (ip==null || port==null){
		const error = {
			errors: {
				error: {
					cause: 'No game server',
					code: '9999',
					message: 'No server found'
				}
			}
		};
		
		return response.send(json2xml(error));
	}
	
	const token = {
		nex_token: {
			host: ip,
			nex_password: nex_password,
			pid: user.pid,
			port: port,
			token: jwt.sign({
				data: {
					type: 'nex_token',
					payload: user
				}
			}, {
				key: config.JWT.NEX.PRIVATE,
				passphrase: config.JWT.NEX.PASSPHRASE
			}, { algorithm: 'RS256'})
		}
	};

	return response.send(json2xml(token));
});

module.exports = routes;