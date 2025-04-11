import express from 'express';
import { getValueFromHeaders } from '@/util';
import { createNNASErrorResponse } from '@/services/nnas/create-response';
import { getPNIDByBasicAuth, getPNIDByNNASAccessToken } from '@/database';
import { HydratedPNIDDocument } from '@/types/mongoose/pnid';

async function PNIDMiddleware(request: express.Request, response: express.Response, next: express.NextFunction): Promise<void> {
	const authHeader = getValueFromHeaders(request.headers, 'authorization');

	if (!authHeader || !(authHeader.startsWith('Bearer') || authHeader.startsWith('Basic'))) {
		return next();
	}

	const parts = authHeader.split(' ');
	const type = parts[0];
	let token = parts[1];
	let pnid: HydratedPNIDDocument | null = null;

	if (request.isCemu) {
		token = Buffer.from(token, 'hex').toString('base64');
	}

	if (type === 'Basic' && request.path.includes('v1/api/people/@me/devices')) {
		pnid = await getPNIDByBasicAuth(token);
	} else if (type === 'Bearer') {
		pnid = await getPNIDByNNASAccessToken(token);
	}

	if (!pnid) {
		if (type === 'Bearer') {
			return createNNASErrorResponse(response, {
				status: 401,
				errors: [
					{
						cause: 'access_token',
						code: '0005',
						message: 'Invalid access token'
					}
				]
			});
		}

		return createNNASErrorResponse(response, {
			status: 401,
			errors: [
				{
					code: '1105',
					message: 'Email address, username, or password, is not valid'
				}
			]
		});
	}

	if (pnid.deleted) {
		return createNNASErrorResponse(response, {
			errors: [
				{
					code: '0112',
					message: pnid.username
				}
			]
		});
	}

	if (pnid.access_level < 0) {
		return createNNASErrorResponse(response, {
			errors: [
				{
					code: '0108',
					message: 'Account has been banned'
				}
			]
		});
	}

	request.pnid = pnid;

	return next();
}

export default PNIDMiddleware;