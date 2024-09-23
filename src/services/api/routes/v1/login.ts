import express from 'express';
import bcrypt from 'bcrypt';
import { getPNIDByUsername, getPNIDByTokenAuth } from '@/database';
import { nintendoPasswordHash, generateToken} from '@/util';
import { config } from '@/config-manager';
import { HydratedPNIDDocument } from '@/types/mongoose/pnid';

const router = express.Router();

/**
 * [POST]
 * Implementation of for: https://api.brocatech.com/v1/login
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
		pnid = await getPNIDByTokenAuth(refreshToken);

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

	const accessTokenOptions = {
		system_type: 0x3, // * API
		token_type: 0x1, // * OAuth Access
		pid: pnid.pid,
		access_level: pnid.access_level,
		title_id: BigInt(0),
		expire_time: BigInt(Date.now() + (3600 * 1000))
	};

	const refreshTokenOptions = {
		system_type: 0x3, // * API
		token_type: 0x2, // * OAuth Refresh
		pid: pnid.pid,
		access_level: pnid.access_level,
		title_id: BigInt(0),
		expire_time: BigInt(Date.now() + (3600 * 1000))
	};

	const accessTokenBuffer = await generateToken(config.aes_key, accessTokenOptions);
	const refreshTokenBuffer = await generateToken(config.aes_key, refreshTokenOptions);

	const accessToken = accessTokenBuffer ? accessTokenBuffer.toString('hex') : '';
	const newRefreshToken = refreshTokenBuffer ? refreshTokenBuffer.toString('hex') : '';

	// TODO - Handle null tokens

	response.json({
		access_token: accessToken,
		token_type: 'Bearer',
		expires_in: 3600,
		refresh_token: newRefreshToken
	});
});

export default router;