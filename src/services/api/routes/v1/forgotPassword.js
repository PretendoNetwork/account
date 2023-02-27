const router = require('express').Router();
const validator = require('validator');
const database = require('../../../../database');
const util = require('../../../../util');

router.post('/', async (request, response) => {
	const { body } = request;
	const { input } = body;

	if (!input || input.trim() === '') {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid or missing input'
		});
	}

	let pnid;

	if (validator.isEmail(input)) {
		pnid = await database.getUserByEmailAddress(input);
	} else {
		pnid = await database.getUserByUsername(input);
	}

	if (pnid) {
		await util.sendForgotPasswordEmail(pnid);
	}

	response.json({
		app: 'api',
		status: 200
	});
});

module.exports = router;