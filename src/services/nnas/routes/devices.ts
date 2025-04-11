import express from 'express';
import { createNNASResponse } from '@/services/nnas/create-response';

const router = express.Router();

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/devices/@current/status
 * Description: Unknown use
 */
router.get('/@current/status', async (request: express.Request, response: express.Response): Promise<void> => {
	// TODO - Finish this
	return createNNASResponse(response, {
		body: {
			device: ''
		}
	});
});

export default router;