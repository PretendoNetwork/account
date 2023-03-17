import express from 'express';
import { getLocalCDNFile } from '@/cache';

const router: express.Router = express.Router();

router.get('/*', async (request: express.Request, response: express.Response) => {
	const filePath: string = request.params[0] as string;

	const file: Buffer = await getLocalCDNFile(filePath);

	if (file) {
		response.send(file);
	} else {
		response.sendStatus(404);
	}
});

export default router;