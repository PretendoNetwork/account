import { getValueFromHeaders } from '@/util';
import { getPNIDByTokenAuth } from '@/database';
import type express from 'express';

async function APIMiddleware(request: express.Request, _response: express.Response, next: express.NextFunction): Promise<void> {
	const authHeader = getValueFromHeaders(request.headers, 'authorization');

	if (!authHeader || !(authHeader.startsWith('Bearer'))) {
		return next();
	}

	try {
		const token = authHeader.split(' ')[1];
		const pnid = await getPNIDByTokenAuth(token);

		request.pnid = pnid;
	} catch (error) {
		console.error('Failed to get PNID: ', error);
	}

	return next();
}

export default APIMiddleware;
