const json2xml = require('json2xml');
const constants = require('../constants');

module.exports = nintendoClientHeaderCheck;

function nintendoClientHeaderCheck(request, response, next) {
	response.set('Content-Type', 'text/xml');
	response.set('Server', 'Nintendo 3DS (http)');
	response.set('X-Nintendo-Date', new Date().getTime());

	const {headers} = request;

	if (
		!headers['x-nintendo-client-id'] ||
		!headers['x-nintendo-client-secret'] ||
		!constants.VALID_CLIENT_ID_SECRET_PAIRS[headers['x-nintendo-client-id']] ||
		headers['x-nintendo-client-secret'] !== constants.VALID_CLIENT_ID_SECRET_PAIRS[headers['x-nintendo-client-id']]
	) {
		return response.send(json2xml({
			errors: {
				error: {
					cause: 'client_id',
					code: '0004',
					message: 'API application invalid or incorrect application credentials'
				}
			}
		}));
	}

	return next();
}