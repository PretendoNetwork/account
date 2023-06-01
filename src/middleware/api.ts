import express from 'express';
import { getValueFromHeaders } from '@/util';
import { getPNIDByTokenAuth } from '@/database';
import { HydratedPNIDDocument } from '@/types/mongoose/pnid';

async function APIMiddleware(request: express.Request, _response: express.Response, next: express.NextFunction): Promise<void> {
	const authHeader: string | undefined = getValueFromHeaders(request.headers, 'authorization');

	if (!authHeader || !(authHeader.startsWith('Bearer'))) {
		return next();
	}

	try {
		const token: string = authHeader.split(' ')[1];
		const pnid: HydratedPNIDDocument | null = await getPNIDByTokenAuth(token);

		request.pnid = pnid;
	} catch (error) {
		// TODO - Log error
	}

	return next();
}

export default APIMiddleware;