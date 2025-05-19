import express from 'express';
import { addPNIDConnection, removePNIDConnection } from '@/database';

const router = express.Router();

const VALID_CONNECTION_TYPES = [
	'discord'
];

/**
 * [POST]
 * Implementation of for: https://api.pretendo.cc/v1/connections/add/TYPE
 * Description: Adds an account connection to the users PNID
 */
router.post('/add/:type', async (request: express.Request, response: express.Response): Promise<void> => {
	const data = request.body?.data;
	const pnid = request.pnid;
	const type = request.params.type;

	if (!pnid) {
		response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid or missing access token'
		});

		return;
	}

	if (!data) {
		response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid or missing connection data'
		});

		return;
	}

	if (!VALID_CONNECTION_TYPES.includes(type)) {
		response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid or missing connection type'
		});

		return;
	}

	let result = await addPNIDConnection(pnid, data, type);

	if (!result) {
		result = {
			app: 'api',
			status: 500,
			error: 'Unknown server error'
		};
	}

	response.status(result.status || 500).json(result);
});

/**
 * [DELETE]
 * Implementation of for: https://api.pretendo.cc/v1/connections/remove/TYPE
 * Description: Removes an account connection from the users PNID
 */
router.delete('/remove/:type', async (request: express.Request, response: express.Response): Promise<void> => {
	const pnid = request.pnid;
	const type = request.params.type;

	if (!pnid) {
		response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid or missing access token'
		});

		return;
	}

	if (!VALID_CONNECTION_TYPES.includes(type)) {
		response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid or missing connection type'
		});

		return;
	}

	let result = await removePNIDConnection(pnid, type);

	if (!result) {
		result = {
			app: 'api',
			status: 500,
			error: 'Unknown server error'
		};
	}

	response.status(result.status).json(result);
});

export default router;
