/*
	This is intentionally going to be written and never used
	It only exists as an example of some of the other header checks Nintendo does and the errors it returns
	We cannot validate these headers as we do not have an internal database of valid console serials, device IDs etc to check against

	The order in which headers are checked, and their returns, are based on responses from https://account.nintendo.net/v1/api/people/@me/devices/owner
	Other endpoints may do different checks in a different order
*/

const json2xml = require('json2xml');

module.exports = nintendoDeviceHeaderCheck;

function nintendoDeviceHeaderCheck(request, response, next) {
	response.set('Content-Type', 'text/xml');
	response.set('Server', 'Nintendo 3DS (http)');
	response.set('X-Nintendo-Date', new Date().getTime());

	// Don't blame me for how jank this gets
	// Nintendo is the one with the weird error return scheme

	const {headers} = request;

	// The first 4 checks return as soon as the error is seen
	if (!headers['x-nintendo-device-id']) {
		return response.send(json2xml({
			errors: {
				error: {
					code: '0002',
					message: 'deviceId format is invalid'
				}
			}
		}));
	}

	if (!headers['x-nintendo-serial-number']) {
		return response.send(json2xml({
			errors: {
				error: {
					code: '0002',
					message: 'serialNumber format is invalid'
				}
			}
		}));
	}

	if (!headers['x-nintendo-platform-id']) {
		return response.send(json2xml({
			errors: {
				error: {
					code: '0002',
					message: 'platformId format is invalid'
				}
			}
		}));
	}

	// The next 4 checks do NOT return as soon as they are seen, and are instead grouped
	const errors = [];

	if (!headers['x-nintendo-local-pin-flag']) {
		errors.push({
			error: {
				cause: 'X-Nintend-Local-Pin-Flag',
				code: '0002',
				message: 'X-Nintend-Local-Pin-Flag format is invalid'
			}
		});
	}

	if (!headers['x-nintendo-country']) {
		errors.push({
			error: {
				cause: 'X-Nintend-Country',
				code: '0002',
				message: 'X-Nintend-Country format is invalid'
			}
		});
	}

	if (!headers['authorization'] || !headers['authorization'].startsWith('Basic ')) {
		errors.push({
			error: {
				cause: 'Authorization',
				code: '0002',
				message: 'Authorization format is invalid'
			}
		});
	}

	if (!headers['x-nintendo-email']) {
		errors.push({
			error: {
				cause: 'X-Nintend-EMail',
				code: '0002',
				message: 'Email address, username, or password is not valid'
			}
		});
	}

	if (errors.length > 0) {
		response.status(400);

		return response.send(json2xml({ errors }));
	}

	// The next 3 checks return as soon as the error is seen
	if (!headers['x-nintendo-device-type']) {
		return response.send(json2xml({
			errors: {
				error: {
					code: '0113',
					message: 'Unauthorized device'
				}
			}
		}));
	}

	if (!headers['x-nintendo-region']) {
		return response.send(json2xml({
			errors: {
				error: {
					code: '0002',
					message: 'region format is invalid'
				}
			}
		}));
	}

	if (!headers['x-nintendo-system-version']) {
		return response.send(json2xml({
			errors: {
				error: {
					code: '0002',
					message: 'version format is invalid'
				}
			}
		}));
	}

	// There are several more headers that are sent, but they do not seen to be validated and do not trigger errors

	return next();
}