import { Router } from 'express';
import cache from '@cache';

const router = Router();

router.get('/*', async (request, response) => {
	const filePath = request.params[0];

	const file = await cache.getLocalCDNFile(filePath);

	if (file) {
		response.send(file);
	} else {
		response.sendStatus(404);
	}
});

export default router;