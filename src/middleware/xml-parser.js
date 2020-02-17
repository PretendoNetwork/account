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
				return next();
			}

			next();
		});
	} else {
		next();
	}
}

module.exports = XMLMiddleware;