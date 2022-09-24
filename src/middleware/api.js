const xmlbuilder = require('xmlbuilder');
const database = require('../database');

async function APIMiddleware(request, response, next) {
	const { headers } = request;

	if (!headers.authorization || !(headers.authorization.startsWith('Bearer'))) {
		return next();
	}

	const token = headers.authorization.split(' ')[1];
	const user = await database.getUserBearer(token);

	request.pnid = user;

	return next();
}

module.exports = APIMiddleware;