import express from 'express';
import moment from 'moment';
import { PNID } from '@/models/pnid';
import { getValueFromQueryString, sendEmailConfirmedEmail } from '@/util';

const router = express.Router();

router.get('/verify', async (request: express.Request, response: express.Response): Promise<void> => {
	const token = getValueFromQueryString(request.query, 'token');

	if (!token || token.trim() == '') {
		response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Missing email token'
		});

		return;
	}

	const pnid = await PNID.findOne({
		'identification.email_token': token
	});

	if (!pnid) {
		response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid email token'
		});

		return;
	}

	const validatedDate = moment().format('YYYY-MM-DDTHH:MM:SS');

	pnid.email.reachable = true;
	pnid.email.validated = true;
	pnid.email.validated_date = validatedDate;

	await pnid.save();

	await sendEmailConfirmedEmail(pnid);

	response.status(200).send('Email validated. You may close this window');
});

export default router;
