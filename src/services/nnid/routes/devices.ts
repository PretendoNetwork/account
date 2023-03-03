import { Router } from 'express';
import xmlbuilder from 'xmlbuilder';

const router = Router();

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/devices/@current/status
 * Description: Unknown use
 */
router.get('/@current/status', async (request, response) => {
	response.send(xmlbuilder.create({
		device: ''
	}).end());
});

export default router;