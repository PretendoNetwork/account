import xmlbuilder from 'xmlbuilder';
import { BanTargetType, BanScopeType } from '@pretendonetwork/grpc/account/v2/ban_details';
import { getValueFromHeaders } from '@/util';
import { getActiveBan, getPNIDByBasicAuth, getPNIDByNNASAccessToken } from '@/database';
import { NNAS_BAN_ERRORS, getNNASBanError } from '@/services/nnas/ban-errors';
import type express from 'express';
import type { HydratedPNIDDocument } from '@/types/mongoose/pnid';

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

	if (pnid.deleted || pnid.marked_for_deletion) {
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

	// * Legacy ban check for bans issued before the bans collection existed
	if (pnid.access_level < 0) {
		const banError = NNAS_BAN_ERRORS.account[BanScopeType.BAN_SCOPE_TYPE_ALL].permanent;

		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					code: banError.code,
					message: banError.message
				}
			}
		}).end());

		return;
	}

	const ban = await getActiveBan(BanTargetType.BAN_TARGET_TYPE_NETWORK_ACCOUNT, [
		pnid.pid.toString()
	]);

	if (ban) {
		const banError = getNNASBanError(ban);

		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					code: banError.code,
					message: banError.message
				}
			}
		}).end());

		return;
	}

	request.pnid = pnid;

	return next();
}

export default PNIDMiddleware;
