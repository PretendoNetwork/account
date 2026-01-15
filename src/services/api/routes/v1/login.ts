import crypto from 'node:crypto';
import express from 'express';
import bcrypt from 'bcrypt';
import { getPNIDByUsername, getPNIDByAPIRefreshToken } from '@/database';
import { nintendoPasswordHash } from '@/util';
import { OAuthToken } from '@/models/oauth_token';
import { SystemType } from '@/types/common/system-types';
import { TokenType } from '@/types/common/token-types';
import { LOG_ERROR } from '@/logger';
import type { HydratedPNIDDocument } from '@/types/mongoose/pnid';

const router = express.Router();

/**
 * [POST]
 * Implementation of for: https://api.pretendo.cc/v1/login
 * Description: Generates an access token for an API user
 * TODO: Replace this with a more robust OAuth2 implementation
 */
router.post('/', async (request: express.Request, response: express.Response): Promise<void> => {
	const grantType = request.body?.grant_type;
	const username = request.body?.username;
	const password = request.body?.password;
	const refreshToken = request.body?.refresh_token;

	if (!['password', 'refresh_token'].includes(grantType)) {
		response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid grant type'
		});

		return;
	}

	if (grantType === 'password' && (!username || username.trim() === '')) {
		response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid or missing username'
		});

		return;
	}

	if (grantType === 'password' && (!password || password.trim() === '')) {
		response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid or missing password'
		});

		return;
	}

	if (grantType === 'refresh_token' && (!refreshToken || refreshToken.trim() === '')) {
		response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid or missing refresh token'
		});

		return;
	}

	let pnid: HydratedPNIDDocument | null;

	if (grantType === 'password') {
		pnid = await getPNIDByUsername(username);

		if (!pnid) {
			response.status(400).json({
				app: 'api',
				status: 400,
				error: 'User not found'
			});

			return;
		}

		const hashedPassword = nintendoPasswordHash(password, pnid.pid);

		if (!pnid || !bcrypt.compareSync(hashedPassword, pnid.password)) {
			response.status(400).json({
				app: 'api',
				status: 400,
				error: 'Invalid or missing password'
			});

			return;
		}
	} else {
		pnid = await getPNIDByAPIRefreshToken(refreshToken);

		if (!pnid) {
			response.status(400).json({
				app: 'api',
				status: 400,
				error: 'Invalid or missing refresh token'
			});

			return;
		}
	}

	if (pnid.deleted) {
		response.status(400).json({
			app: 'api',
			status: 400,
			error: 'User not found'
		});

		return;
	}

	try {
		const accessToken = crypto.randomBytes(16).toString('hex');
		const newRefreshToken = crypto.randomBytes(20).toString('hex');

		await OAuthToken.create({
			token: crypto.createHash('sha256').update(accessToken).digest('hex'),
			client_id: 'a2efa818a34fa16b8afbc8a74eba3eda', // TODO - This is the Wii U config, change this?
			client_secret: 'c91cdb5658bd4954ade78533a339cf9a', // TODO - This is the Wii U config, change this?
			pid: pnid.pid,
			info: {
				system_type: SystemType.API,
				token_type: TokenType.OAuthAccess,
				title_id: BigInt(0),
				issued: new Date(),
				expires: new Date(Date.now() + (3600 * 1000))
			}
		});

		await OAuthToken.create({
			token: crypto.createHash('sha256').update(newRefreshToken).digest('hex'),
			client_id: 'a2efa818a34fa16b8afbc8a74eba3eda', // TODO - This is the Wii U config, change this?
			client_secret: 'c91cdb5658bd4954ade78533a339cf9a', // TODO - This is the Wii U config, change this?
			pid: pnid.pid,
			info: {
				system_type: SystemType.API,
				token_type: TokenType.OAuthRefresh,
				title_id: BigInt(0),
				issued: new Date(),
				expires: new Date(Date.now() + 12 * 3600 * 1000)
			}
		});

		// TODO - Handle null tokens

		response.json({
			access_token: accessToken,
			token_type: 'Bearer',
			expires_in: 3600,
			refresh_token: newRefreshToken
		});
	} catch (error: any) {
		LOG_ERROR('/v1/login - token generation: ' + error);
		if (error.stack) {
			console.error(error.stack);
		}

		response.status(500).json({
			app: 'api',
			status: 500,
			error: 'Internal server error'
		});
	}
});

export default router;
