import express from 'express';
import { getValueFromHeaders } from '@/util';
import { getPNIDByAPIAccessToken } from '@/database';

async function APIMiddleware(request: express.Request, _response: express.Response, next: express.NextFunction): Promise<void> {
	const authHeader = getValueFromHeaders(request.headers, 'authorization');

	if (!authHeader || !(authHeader.startsWith('Bearer'))) {
		return next();
	}

	try {
		const token = authHeader.split(' ')[1];
		const pnid = await getPNIDByAPIAccessToken(token);

		request.pnid = pnid;
	} catch (error) {
		// TODO - Log error
	}

	return next();
}

export default APIMiddleware;