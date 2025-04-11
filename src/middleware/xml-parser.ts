import express from 'express';
import { document as xmlParser } from 'xmlbuilder2';
import { getValueFromHeaders, mapToObject } from '@/util';
import { createNNASErrorResponse } from '@/services/nnas/create-response';

function XMLMiddleware(request: express.Request, response: express.Response, next: express.NextFunction): void {
	if (request.method == 'POST' || request.method == 'PUT') {
		const contentType = getValueFromHeaders(request.headers, 'content-type');
		const contentLength = getValueFromHeaders(request.headers, 'content-length');
		let body = '';

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
				request.body = mapToObject(request.body);
			} catch (error) {
				// TODO - This is not a real error code, check to see if better one exists
				return createNNASErrorResponse(response, {
					status: 401,
					errors: [
						{
							code: '0004',
							message: 'XML parse error'
						}
					]
				});
			}

			next();
		});
	} else {
		next();
	}
}

export default XMLMiddleware;