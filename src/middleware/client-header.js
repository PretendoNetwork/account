const xmlbuilder = require('xmlbuilder');

const VALID_CLIENT_ID_SECRET_PAIRS = {
	// 'Key' is the client ID, 'Value' is the client secret
	'a2efa818a34fa16b8afbc8a74eba3eda': 'c91cdb5658bd4954ade78533a339cf9a', // Possibly WiiU exclusive?
	'daf6227853bcbdce3d75baee8332b': '3eff548eac636e2bf45bb7b375e7b6b0', // Possibly 3DS exclusive?
	'ea25c66c26b403376b4c5ed94ab9cdea': 'd137be62cb6a2b831cad8c013b92fb55', // Possibly 3DS exclusive?
};


function nintendoClientHeaderCheck(request, response, next) {
	response.set('Content-Type', 'text/xml');
	response.set('Server', 'Nintendo 3DS (http)');
	response.set('X-Nintendo-Date', new Date().getTime());

	const {headers} = request;

	if (
		!headers['x-nintendo-client-id'] ||
		!headers['x-nintendo-client-secret'] ||
		!VALID_CLIENT_ID_SECRET_PAIRS[headers['x-nintendo-client-id']] ||
		headers['x-nintendo-client-secret'] !== VALID_CLIENT_ID_SECRET_PAIRS[headers['x-nintendo-client-id']]
	) {
		return response.send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'client_id',
					code: '0004',
					message: 'API application invalid or incorrect application credentials'
				}
			}
		}).end());
	}

	return next();
}

module.exports = nintendoClientHeaderCheck;