import express from 'express';
import { getValueFromHeaders } from '@/util';
import { getPNIDByTokenAuth } from '@/database';
import { LOG_ERROR } from '@/logger';
async function APIMiddleware(request: express.Request, _response: express.Response, next: express.NextFunction): Promise<void> {
	const authHeader = getValueFromHeaders(request.headers, 'authorization');

	if (!authHeader || !(authHeader.startsWith('Bearer'))) {
		return next();
	}

	try {
		const token = authHeader.split(' ')[1];
		const pnid = await getPNIDByTokenAuth(token);

		request.pnid = pnid;
	} catch (error: any) {
		LOG_ERROR('api middleware - decode pnid: ' + error);
		if (error.stack) console.error(error.stack);
	}

	return next();
}

export default APIMiddleware;