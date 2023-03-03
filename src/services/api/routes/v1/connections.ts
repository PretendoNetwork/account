import { Router } from 'express';
import database from '../../../../database';

const router = Router();

const VALID_CONNECTION_TYPES = [
	'discord'
];

/**
 * [POST]
 * Implementation of for: https://api.pretendo.cc/v1/connections/add/TYPE
 * Description: Adds an account connection to the users PNID
 */
router.post('/add/:type', async (request, response) => {
	const { body, pnid } = request;
	const { type } = request.params;
	const { data } = body;

	if (!pnid) {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid or missing access token'
		});
	}

	if (!data) {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid or missing connection data'
		});
	}

	if (!VALID_CONNECTION_TYPES.includes(type)) {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid or missing connection type'
		});
	}

	const result = await database.addUserConnection(pnid, data, type);

	response.status(result.status).json(result);
});

/**
 * [DELETE]
 * Implementation of for: https://api.pretendo.cc/v1/connections/remove/TYPE
 * Description: Removes an account connection from the users PNID
 */
router.delete('/remove/:type', async (request, response) => {
	const { pnid } = request;
	const { type } = request.params;

	if (!pnid) {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid or missing access token'
		});
	}

	if (!VALID_CONNECTION_TYPES.includes(type)) {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid or missing connection type'
		});
	}

	const result = await database.removeUserConnection(pnid, type);

	response.status(result.status).json(result);
});

export default router;