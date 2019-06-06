const router = require('express').Router();
const json2xml = require('json2xml');
const nintendoClientHeaderCheck = require('../middleware/nintendoClientHeaderCheck');

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/admin/mapped_ids
 * Description: Unknown use
 */
router.get('/mapped_ids', nintendoClientHeaderCheck, async (request, response) => {
	const {query} = request;
	const {input_type, output_type, input} = query;

	if (!input_type || !output_type || !input) {
		return response.send(json2xml({
			error: {
				cause: 'Bad Request',
				code: '1600',
				message: 'Unable to process request'
			}
		}));
	}

	const values = input.split(',');

	const output = [];

	for (const value of values) {
		let outId = '';
		let user;

		switch (input_type) {
			case 'user_id':
				user = await request.database.getUserByUsername(value);
				break;
			case 'pid':
				user = await request.database.getUserByPID(value);
				break;
		}
		
		if (user) {
			switch (output_type) {
				case 'user_id':
					outId = user.get('username');
					break;
				case 'pid':
					outId = user.get('pid');
					break;
			}
		}

		output.push({
			mapped_id: {
				in_id: value,
				out_id: outId
			}
		});
	}

	return response.send(json2xml({
		mapped_ids: output
	}));
});

module.exports = router;