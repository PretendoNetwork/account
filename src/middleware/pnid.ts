import express from 'express';
import xmlbuilder from 'xmlbuilder';
import { getUserBasic, getUserBearer } from '@/database';
import { HydratedPNIDDocument } from '@/types/mongoose/pnid';

async function PNIDMiddleware(request: express.Request, response: express.Response, next: express.NextFunction): Promise<void> {
	const authHeader: string | undefined = request.headers.authorization;

	if (!authHeader || !(authHeader.startsWith('Bearer') || authHeader.startsWith('Basic'))) {
		return next();
	}

	const parts: string[] = authHeader.split(' ');
	const type: string = parts[0];
	let token: string = parts[1];
	let user: HydratedPNIDDocument | null;

	if (request.isCemu) {
		token = Buffer.from(token, 'hex').toString('base64');
	}

	if (type === 'Basic') {
		user = await getUserBasic(token);
	} else {
		user = await getUserBearer(token);
	}

	if (!user) {
		response.status(401);

		if (type === 'Bearer') {
			response.send(xmlbuilder.create({
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

		response.send(xmlbuilder.create({
			errors: {
				error: {
					code: '1105',
					message: 'Email address, username, or password, is not valid'
				}
			}
		}).end());

		return;
	}

	if (user.get('access_level') < 0) {
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

	request.pnid = user;

	return next();
}

export default PNIDMiddleware;