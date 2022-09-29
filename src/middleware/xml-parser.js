const { document: xmlParser } = require('xmlbuilder2');

function XMLMiddleware(request, response, next) {
	if (request.method == 'POST' || request.method == 'PUT') {
		const headers = request.headers;
		let body = '';
		
		if (
			!headers['content-type'] ||
			!headers['content-type'].toLowerCase().includes('xml')
		) {
			return next();
		}

		request.setEncoding('utf-8');
		request.on('data', (chunk) => {
			body += chunk;
		});

		request.on('end', () => {
			try {
				request.body = xmlParser(body);
				request.body = request.body.toObject();
			} catch (error) {
				response.status(401);

				// TODO: This is not a real error code, check to see if better one exists
				return response.send(xmlbuilder.create({
					errors: {
						error: {
							code: '0004',
							message: 'XML parse error'
						}
					}
				}).end());
			}

			next();
		});
	} else {
		next();
	}
}

module.exports = XMLMiddleware;