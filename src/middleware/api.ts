import express from 'express';
import database from '@/database';
import { HydratedPNIDDocument } from '@/types/mongoose/pnid';

async function APIMiddleware(request: express.Request, _response: express.Response, next: express.NextFunction): Promise<void> {
	const authHeader: string = request.headers.authorization;

	if (!authHeader || !(authHeader.startsWith('Bearer'))) {
		return next();
	}

	const token: string = authHeader.split(' ')[1];
	const user: HydratedPNIDDocument = await database.getUserBearer(token);

	request.pnid = user;

	return next();
}

export default APIMiddleware;