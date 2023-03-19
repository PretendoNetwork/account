import express from 'express';
import xmlbuilder from 'xmlbuilder';
import { getValueFromQueryString } from '@/util';
import { PNID } from '@/models/pnid';
import { HydratedPNIDDocument } from '@/types/mongoose/pnid';

const router: express.Router = express.Router();

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/admin/mapped_ids
 * Description: Maps between NNID usernames and PIDs
 */
router.get('/mapped_ids', async (request: express.Request, response: express.Response) => {
	const inputType: string | undefined = getValueFromQueryString(request.query, 'input_type');
	const outputType: string | undefined = getValueFromQueryString(request.query, 'output_type');
	const input: string | undefined = getValueFromQueryString(request.query, 'input');

	if (!inputType || !outputType || !input) {
		return response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'Bad Request',
					code: '1600',
					message: 'Unable to process request'
				}
			}
		}).end());
	}

	let inputList: string[] = input.split(',');
	let queryInput: string;
	let queryOutput: string;

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

	// * This is slower than PNID.where()
	// * but it ensures that each input
	// * ALWAYS has an output and filters
	// * out unwanted input/output types
	const results: {
		in_id: string;
		out_id: string;
	}[] = [];
	const allowedTypes: string[] = ['pid', 'user_id'];

	for (const input of inputList) {
		const result: {
			in_id: string;
			out_id: string;
		} = {
			in_id: input,
			out_id: ''
		};

		if (allowedTypes.includes(inputType) && allowedTypes.includes(outputType)) {
			const query: {
				usernameLower?: string;
				pid?: number;
			} = {};

			if (queryInput === 'usernameLower') {
				query.usernameLower = input;
			}

			if (queryInput === 'pid') {
				query.pid = Number(input);

				if (isNaN(query.pid)) {
					// * Bail early
					results.push(result);
					continue;
				}
			}

			const searchResult: HydratedPNIDDocument | null = await PNID.findOne(query);

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