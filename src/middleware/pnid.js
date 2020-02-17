const xmlbuilder = require('xmlbuilder');
const database = require('../database');

async function PNIDMiddleware(request, response, next) {
	const { headers } = request;

	if (!headers.authorization || !(headers.authorization.startsWith('Bearer') || headers.authorization.startsWith('Basic'))) {
		return next();
	}

	const [type, token] = headers.authorization.split(' ');
	let user;

	if (type === 'Basic') {
		user = await database.getUserBasic(token);
	} else {
		user = await database.getUserBearer(token);
	}

	if (!user) {
		response.status(401);
	
		if (type === 'Bearer') {
			return response.send(xmlbuilder.create({
				errors: {
					error: {
						cause: 'access_token',
						code: '0005',
						message: 'Invalid access token'
					}
				}
			}).end());
		}
		
		return response.send(xmlbuilder.create({
			errors: {
				error: {
					code: '1105',
					message: 'Email address, username, or password, is not valid'
				}
			}
		}).end());
	}

	request.pnid = user;

	return next();
}

module.exports = PNIDMiddleware;