import express from 'express';
import { getValueFromQueryString } from '@/util';
import { createNNASErrorResponse, createNNASResponse } from '@/services/nnas/create-response';
import { PNID } from '@/models/pnid';

const router = express.Router();

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/admin/mapped_ids
 * Description: Maps between NNID usernames and PIDs
 */
router.get('/mapped_ids', async (request: express.Request, response: express.Response): Promise<void> => {
	const inputType = getValueFromQueryString(request.query, 'input_type');
	const outputType = getValueFromQueryString(request.query, 'output_type');
	const input = getValueFromQueryString(request.query, 'input');

	if (!inputType || !outputType || !input) {
		return createNNASErrorResponse(response, {
			errors: [
				{
					cause: 'Bad Request',
					code: '1600',
					message: 'Unable to process request'
				}
			]
		});
	}

	let inputList = input.split(',');
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
	const allowedTypes = ['pid', 'user_id'];

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

			const searchResult = await PNID.findOne(query);

			if (searchResult) {
				result.out_id = searchResult.get(queryOutput);
			}
		}

		results.push(result);
	}

	return createNNASResponse(response, {
		body: {
			mapped_ids: {
				mapped_id: results
			}
		}
	});
});

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/admin/time
 * Description: Gets the current server time
 */
router.get('/time', async (request: express.Request, response: express.Response): Promise<void> => {
	response.set('X-Nintendo-Date', Date.now().toString());
	response.set('Server', 'Nintendo 3DS (http)');
	response.set('Date', new Date().toUTCString());

	response.send('');
});


export default router;