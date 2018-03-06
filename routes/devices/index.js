const routes = require('express').Router();
const json2xml = require('json2xml');
const debug = require('../../debugger');
const constants = require('../../constants');
const route_debugger = new debug('Devices Route');

route_debugger.success('Loading \'devices\' API routes');

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/devices/@current/status
 * Description: Unknown use
 */
routes.get('/@current/status', (request, response) => {
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

	return response.send(json2xml({device: null}));
});

module.exports = routes;