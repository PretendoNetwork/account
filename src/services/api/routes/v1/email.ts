import { Router } from 'express';
import moment from 'moment';
import { PNID } from '../../../../models/pnid';
import util from '../../../../util';

const router = Router();

router.get('/verify', async (request, response) => {
	let token: string;

	if (Array.isArray(request.query.token)) {
		token = request.query.token[0] as string;
	} else {
		token = request.query.token as string;
	}

	if (!token || token.trim() == '') {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Missing email token'
		});
	}

	const pnid = await PNID.findOne({
		'identification.email_token': token
	});

	if (!pnid) {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid email token'
		});
	}

	const validatedDate = moment().format('YYYY-MM-DDTHH:MM:SS');

	pnid.set('email.reachable', true);
	pnid.set('email.validated', true);
	pnid.set('email.validated_date', validatedDate);

	await pnid.save();

	await util.sendEmailConfirmedEmail(pnid);

	response.status(200).send('Email validated. You may close this window');
});

export default router;