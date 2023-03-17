import express from 'express';
import moment from 'moment';
import { PNID } from '@/models/pnid';
import { sendEmailConfirmedEmail } from '@/util';
import { HydratedPNIDDocument } from '@/types/mongoose/pnid';

const router: express.Router = express.Router();

router.get('/verify', async (request: express.Request, response: express.Response) => {
	const token: string = request.query.token as string;

	if (!token || token.trim() == '') {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Missing email token'
		});
	}

	const pnid: HydratedPNIDDocument | null = await PNID.findOne({
		'identification.email_token': token
	});

	if (!pnid) {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid email token'
		});
	}

	const validatedDate: string = moment().format('YYYY-MM-DDTHH:MM:SS');

	pnid.set('email.reachable', true);
	pnid.set('email.validated', true);
	pnid.set('email.validated_date', validatedDate);

	await pnid.save();

	await sendEmailConfirmedEmail(pnid);

	response.status(200).send('Email validated. You may close this window');
});

export default router;