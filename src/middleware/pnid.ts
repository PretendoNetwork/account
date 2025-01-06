import express from 'express';
import xmlbuilder from 'xmlbuilder';
import { getValueFromHeaders } from '@/util';
import { getPNIDByBasicAuth, getPNIDByTokenAuth } from '@/database';
import { HydratedPNIDDocument } from '@/types/mongoose/pnid';

async function PNIDMiddleware(request: express.Request, response: express.Response, next: express.NextFunction): Promise<void> {
	const authHeader = getValueFromHeaders(request.headers, 'authorization');
	const email = getValueFromHeaders(request.headers, 'x-nintendo-email');

	if (!authHeader || !(authHeader.startsWith('Bearer') || authHeader.startsWith('Basic'))) {
		return next();
	}

	const parts = authHeader.split(' ');
	const type = parts[0];
	let token = parts[1];
	let pnid: HydratedPNIDDocument | null;

	if (request.isCemu) {
		token = Buffer.from(token, 'hex').toString('base64');
	}

	if (type === 'Basic') {
		pnid = await getPNIDByBasicAuth(token);
	} else {
		pnid = await getPNIDByTokenAuth(token);
	}

	if (!pnid) {
		if (type === 'Bearer') {
			response.status(401).send(xmlbuilder.create({
				errors: {
					error: {
						cause: 'access_token',
						code: '0005',
						message: 'Invalid access token'
					}
				}
			}).end());

			return;
		}

		response.status(401).send(xmlbuilder.create({
			errors: {
				error: {
					code: '1105',
					message: 'Email address, username, or password, is not valid'
				}
			}
		}).end());

		return;
	}

	if (email != undefined && pnid.email.address !== email) {
		response.status(401).send(xmlbuilder.create({
			errors: {
				error: {
					code: '1105',
					message: 'Email address, username, or password, is not valid'
				}
			}
		}).end());

		return;
	}

	if (pnid.deleted) {
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					code: '0112',
					message: pnid.username
				}
			}
		}).end());

		return;
	}

	if (pnid.access_level < 0) {
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					code: '0122',
					message: 'Device has been banned by game server'
				}
			}
		}).end());

		return;
	}

	request.pnid = pnid;

	return next();
}

export default PNIDMiddleware;
