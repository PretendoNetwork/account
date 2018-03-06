const routes = require('express').Router();
const json2xml = require('json2xml');
const database = require('../../db');
const constants = require('../../constants');
const debug = require('../../debugger');
const route_debugger = new debug('Admin Route');

route_debugger.success('Loading \'admin\' API routes');

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/admin/mapped_ids
 * Description: Maps given input to expected output
 */
routes.all('/mapped_ids', async (request, response) => {
	response.set('Content-Type', 'text/xml');
	response.set('Server', 'Nintendo 3DS (http)');
	response.set('X-Nintendo-Date', new Date().getTime());

	const headers = request.headers;
	const _GET = request.query;

	if (
		!headers['x-nintendo-client-id'] ||
		!headers['x-nintendo-client-secret'] ||
		!constants.VALID_CLIENT_ID_SECRET_PAIRS[headers['x-nintendo-client-id']] ||
		headers['x-nintendo-client-secret'] !== constants.VALID_CLIENT_ID_SECRET_PAIRS[headers['x-nintendo-client-id']]
	) {
		const error = {
			errors: {
				error: {
					cause: 'client_id',
					code: '0004',
					message: 'API application invalid or incorrect application credentials'
				}
			}
		};

		return response.send(json2xml(error));
	}

	if (
		!_GET.output_type ||
		!_GET.input_type ||
		!_GET.input ||
		_GET.input.trim() == ''
	) {
		const error = {
			errors: {
				error: {
					cause: 'Bad Request',
					code: '1600',
					message: 'Unable to process request'
				}
			}
		};

		return response.send(json2xml(error));
	}

	const output = {
		mapped_ids: [
		]
	};

	_GET.input = _GET.input.split(',');

	switch (true) {
		case (_GET.input_type === 'user_id' && _GET.output_type === 'pid'):
			await _GET.input.asyncForEach(async user_id => {
				const user = await database.user_collection.findOne({
					user_id_flat: user_id.toLowerCase(),
				});
				let out_id = null;

				if (user) {
					out_id = user.pid;
				}

				output.mapped_ids.push({
					mapped_id: {
						in_id: user_id,
						out_id: out_id
					}
				});
			});
			break;
		default:
			_GET.input.forEach(input => {
				output.mapped_ids.push({
					mapped_id: {
						in_id: input,
						out_id: null
					}
				});
			});
	}
  
	response.send(json2xml(output));
});

module.exports = routes;


Array.prototype.asyncForEach = async function (cb) {
	for (let i=0;i<this.length;i++) {
		await cb(this[i], i, this);
	}
};