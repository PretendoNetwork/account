const routes = require('express').Router();
const json2xml = require('json2xml');
const debug = require('../../debugger');
const route_debugger = new debug('Provider Route'.green);

route_debugger.log('Loading \'provider\' API routes');

//The game ips and ports are stored here. When the game tries to access its specific server, it will be given the respecive ip and port.
const gamePort = {
	friends: {
		ip: '10.0.0.225',
		port: '1300'
	},
	supermariomaker: {
		ip: '10.0.0.225',
		port: '1301'
	}
};

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/provider/service_token/@me
 * Description: Gets service token
 */
routes.get('/service_token/@me', async (request, response) => {
	response.set('Content-Type', 'text/xml');
	response.set('Server', 'Nintendo 3DS (http)');
	response.set('X-Nintendo-Date', new Date().getTime());
	
	const token = {
		service_token: {
			token: 'pretendo_test'
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
	
	let ip = null;
	let port = null;
	
	console.log(request.query.game_server_id);
	
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
			nex_password: 'pretendo',
			pid: request.headers['authorization'].replace('Bearer ',''),
			port: port,
			token: 'pretendo_test'
		}
	};

	return response.send(json2xml(token));
});

module.exports = routes;