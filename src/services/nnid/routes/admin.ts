import { Router } from 'express';
import xmlbuilder from 'xmlbuilder';
import { PNID } from '../../../models/pnid';

const router = Router();

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/admin/mapped_ids
 * Description: Maps between NNID usernames and PIDs
 */
router.get('/mapped_ids', async (request, response) => {

	let inputType: string;
	let inputList: string[];
	let outputType: string;
	let queryInput: string;
	let queryOutput: string;

	if (Array.isArray(request.query.input_type)) {
		inputType = request.query.input_type[0] as string;
	} else {
		inputType = request.query.input_type as string;
	}

	if (Array.isArray(request.query.input)) {
		inputList = request.query.input as string[];
	} else {
		const input = request.query.input as string;
		inputList = input.split(',');
	}

	if (Array.isArray(request.query.output_type)) {
		outputType = request.query.output_type[0] as string;
	} else {
		outputType = request.query.output_type as string;
	}

	inputList = inputList.filter(input => input); // * Remove null inputs

	if (inputType === 'user_id') {
		queryInput = 'usernameLower';
		inputList = inputList.map(name => name.toLowerCase());
	} else {
		queryInput = 'pid';
	}

	if (outputType === 'user_id') {
		queryOutput = 'username';
	} else {
		queryOutput = 'pid';
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

		if (allowedTypes.includes(inputType) && allowedTypes.includes(outputType)) {
			const query = {};
			query[queryInput] = input;

			const searchResult = await PNID.findOne(query);

			if (searchResult) {
				result.out_id = searchResult.get(queryOutput);
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

export default router;