import express from 'express';
import bcrypt from 'bcrypt';
import { getPNIDByUsername, getPNIDByAPIRefreshToken } from '@/database';
import { nintendoPasswordHash, generateOAuthTokens} from '@/util';
import { HydratedPNIDDocument } from '@/types/mongoose/pnid';

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
		const systemType = 0x3; // * API
		const { accessToken, refreshToken, accessTokenExpiresInSecs } = generateOAuthTokens(systemType, pnid);

		response.json({
			access_token: accessToken,
			token_type: 'Bearer',
			expires_in: accessTokenExpiresInSecs,
			refresh_token: refreshToken
		});
	} catch {
		response.status(500).json({
			app: 'api',
			status: 500,
			error: 'Internal server error'
		});
	}
});

export default router;