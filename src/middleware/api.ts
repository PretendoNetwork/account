import express from 'express';
import { getUserBearer } from '@/database';
import { HydratedPNIDDocument } from '@/types/mongoose/pnid';

async function APIMiddleware(request: express.Request, _response: express.Response, next: express.NextFunction): Promise<void> {
	const authHeader: string | undefined = request.headers.authorization;

	if (!authHeader || !(authHeader.startsWith('Bearer'))) {
		return next();
	}

	const token: string = authHeader.split(' ')[1];
	const user: HydratedPNIDDocument | null = await getUserBearer(token);

	request.pnid = user;

	return next();
}

export default APIMiddleware;