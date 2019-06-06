const json2xml = require('json2xml');

module.exports = PNIDMiddleware;

async function PNIDMiddleware(request, response, next) {
	const {headers} = request;
	if (!headers.authorization || !(headers.authorization.startsWith('Bearer') || headers.authorization.startsWith('Basic'))) {
		return next();
	}

	const [type, token] = headers.authorization.split(' ');
	let user;

	if (type === 'Basic') {
		user = await request.database.getUserBasic(token);
	} else {
		user = await request.database.getUserBearer(token);
	}

	if (user) {
		request.pnid = user;
		return next();
	}

	response.status(401);
	
	if (type === 'Bearer') {
		return response.send(json2xml({
			errors: {
				error: {
					cause: 'access_token',
					code: '0005',
					message: 'Invalid access token'
				}
			}
		}));
	} else {
		return response.send(json2xml({
			errors: {
				error: {
					code: '1105',
					message: 'Email address, username, or password, is not valid'
				}
			}
		}));
	}
	
}