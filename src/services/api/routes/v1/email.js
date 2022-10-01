const router = require('express').Router();
const moment = require('moment');
const { PNID } = require('../../../../models/pnid');
const util = require('../../../../util');

router.get('/verify', async (request, response) => {
	const { token } = request.query;

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

module.exports = router;