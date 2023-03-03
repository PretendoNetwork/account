import xmlbuilder from 'xmlbuilder';
import database from '../database';

export async function APIMiddleware(request, _response, next) {
	const { headers } = request;

	if (!headers.authorization || !(headers.authorization.startsWith('Bearer'))) {
		return next();
	}

	const token = headers.authorization.split(' ')[1];
	const user = await database.getUserBearer(token);

	request.pnid = user;

	return next();
}

export default APIMiddleware;