import express from 'express';
import { getValueFromHeaders } from '@/util';
import { getPNIDByBearerAuth } from '@/database';
import { HydratedPNIDDocument } from '@/types/mongoose/pnid';

async function APIMiddleware(request: express.Request, _response: express.Response, next: express.NextFunction): Promise<void> {
	const authHeader: string | undefined = getValueFromHeaders(request.headers, 'authorization');

	if (!authHeader || !(authHeader.startsWith('Bearer'))) {
		return next();
	}

	const token: string = authHeader.split(' ')[1];
	const pnid: HydratedPNIDDocument | null = await getPNIDByBearerAuth(token);

	request.pnid = pnid;

	return next();
}

export default APIMiddleware;