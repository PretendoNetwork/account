import express from 'express';
import { getLocalCDNFile } from '@/cache';

const router = express.Router();

router.get('/*', async (request: express.Request, response: express.Response): Promise<void> => {
	const filePath = request.params[0];

	const file = await getLocalCDNFile(filePath);

	if (file) {
		response.send(file);
	} else {
		response.sendStatus(404);
	}
});

export default router;