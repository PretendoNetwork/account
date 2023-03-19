import express from 'express';
import validator from 'validator';
import { getPNIDByEmailAddress, getPNIDByUsername } from '@/database';
import { sendForgotPasswordEmail } from '@/util';
import { HydratedPNIDDocument } from '@/types/mongoose/pnid';

const router: express.Router = express.Router();

router.post('/', async (request: express.Request, response: express.Response) => {
	const input: string = request.body?.input;

	if (!input || input.trim() === '') {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid or missing input'
		});
	}

	let pnid: HydratedPNIDDocument | null;

	if (validator.isEmail(input)) {
		pnid = await getPNIDByEmailAddress(input);
	} else {
		pnid = await getPNIDByUsername(input);
	}

	if (pnid) {
		await sendForgotPasswordEmail(pnid);
	}

	response.json({
		app: 'api',
		status: 200
	});
});

export default router;