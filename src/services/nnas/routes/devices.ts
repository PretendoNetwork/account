import express from 'express';
import xmlbuilder from 'xmlbuilder';

const router = express.Router();

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/devices/@current/status
 * Description: Unknown use
 */
router.get('/@current/status', async (request: express.Request, response: express.Response): Promise<void> => {
	// TODO - Finish this
	response.send(xmlbuilder.create({
		device: ''
	}).end());
});

/**
 * [PUT]
 * Replacement for: https://account.nintendo.net/v1/api/devices/@current/inactivate
 * Description: Used for factory resets, unsure what it exactly does, maybe unlinks the account?
 */
router.put('/@current/inactivate', async (request: express.Request, response: express.Response): Promise<void> => {
	// TODO - Finish this
	response.status(200).send('');
});

export default router;