import express from 'express';
import xmlbuilder from 'xmlbuilder';
import { document as xmlParser } from 'xmlbuilder2';

function XMLMiddleware(request: express.Request, response: express.Response, next: express.NextFunction): void {
	if (request.method == 'POST' || request.method == 'PUT') {
		const contentType: string | undefined = request.headers['content-type'];
		const contentLength: string | undefined = request.headers['content-length'];
		let body: string = '';

		if (
			!contentType ||
			!contentType.toLowerCase().includes('xml')
		) {
			return next();
		}

		if (
			!contentLength ||
			parseInt(contentLength) === 0
		) {
			return next();
		}

		request.setEncoding('utf-8');
		request.on('data', (chunk: string) => {
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

export default XMLMiddleware;