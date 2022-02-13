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
	inputList = inputList.filter(input => input); // remove nulls

	if (inputType === 'user_id') {
		inputType = 'usernameLower';
		inputList = inputList.map(name => name.toLowerCase());
	}

	if (outputType === 'user_id') {
		outputType = 'username';
	}

	// This is slower than PNID.where()
	// but it ensures that each input
	// ALWAYS has an output and filters
	// out unwanted input/output types
	const results = [];
	const allowedTypes = ['pid', 'user_id'];
	
	for (const input of inputList) {
		const result = {
			in_id: input,
			out_id: ''
		};

		if (allowedTypes.includes(request.query.input_type) && allowedTypes.includes(request.query.output_type)) {
			const query = {};
			query[inputType] = input;

			const searchResult = await PNID.findOne(query);

			if (searchResult) {
				result.out_id = searchResult.get(outputType);
			}
		}

		results.push(result);
	}

	response.send(xmlbuilder.create({
		mapped_ids: {
			mapped_id: results
		}
	}).end());
});

module.exports = router;