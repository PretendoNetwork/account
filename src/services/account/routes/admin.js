const router = require('express').Router();
const xmlbuilder = require('xmlbuilder');
const { PNID } = require('../../../models/pnid');
const clientHeaderCheck = require('../../../middleware/client-header');

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/admin/mapped_ids
 * Description: Maps given input to expected output
 */
router.get('/mapped_ids', clientHeaderCheck, async (request, response) => {

	let { input: inputList, input_type: inputType, output_type: outputType } = request.query;
	inputList = inputList.split(',');

	if (inputType === 'user_id') {
		inputType = 'usernameLower';

		inputList = inputList.filter(name => name);
		inputList = inputList.map(name => name.toLowerCase());
	}

	if (outputType === 'user_id') {
		outputType = 'username';
	}

	let results = await PNID.where(inputType, inputList);
	results = results.map(user => ({
		in_id: user.get(inputType),
		out_id: user.get(outputType) || ''
	}));

	response.send(xmlbuilder.create({
		mapped_ids: {
			mapped_id: results
		}
	}).end());
});

module.exports = router;