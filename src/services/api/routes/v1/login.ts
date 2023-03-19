import express from 'express';
import bcrypt from 'bcrypt';
import fs from 'fs-extra';
import { getPNIDByUsername, getPNIDByBearerAuth } from '@/database';
import { getServicePublicKey, getServiceSecretKey } from '@/cache';
import { nintendoPasswordHash, generateToken} from '@/util';
import { CryptoOptions } from '@/types/common/crypto-options';
import { TokenOptions } from '@/types/common/token-options';
import { HydratedPNIDDocument } from '@/types/mongoose/pnid';

const router: express.Router = express.Router();

/**
 * [POST]
 * Implementation of for: https://api.pretendo.cc/v1/login
 * Description: Generates an access token for an API user
 * TODO: Replace this with a more robust OAuth2 implementation
 */
router.post('/', async (request: express.Request, response: express.Response) => {
	const grantType: string = request.body?.grantType;
	const username: string = request.body?.username;
	const password: string = request.body?.password;
	const refreshToken: string = request.body?.refresh_token;

	if (!['password', 'refresh_token'].includes(grantType)) {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid grant type'
		});
	}

	if (grantType === 'password' && (!username || username.trim() === '')) {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid or missing username'
		});
	}

	if (grantType === 'password' && (!password || password.trim() === '')) {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid or missing password'
		});
	}

	if (grantType === 'refresh_token' && (!refreshToken || refreshToken.trim() === '')) {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid or missing refresh token'
		});
	}

	let pnid: HydratedPNIDDocument | null;

	if (grantType === 'password') {
		pnid = await getPNIDByUsername(username);

		if (!pnid) {
			return response.status(400).json({
				app: 'api',
				status: 400,
				error: 'User not found'
			});
		}

		const hashedPassword: string = nintendoPasswordHash(password, pnid.pid);

		if (!pnid || !bcrypt.compareSync(hashedPassword, pnid.password)) {
			return response.status(400).json({
				app: 'api',
				status: 400,
				error: 'Invalid or missing password'
			});
		}
	} else {
		pnid = await getPNIDByBearerAuth(refreshToken);

		if (!pnid) {
			return response.status(400).json({
				app: 'api',
				status: 400,
				error: 'Invalid or missing refresh token'
			});
		}
	}

	const cryptoPath: string = `${__dirname}/../../../../../certs/service/account`;

	if (!await fs.pathExists(cryptoPath)) {
		// Need to generate keys
		return response.status(500).json({
			app: 'api',
			status: 500,
			error: 'Failed to locate crypto keys. Please contact an administrator'
		});
	}

	const publicKey: Buffer = await getServicePublicKey('account');
	const secretKey: Buffer = await getServiceSecretKey('account');

	const cryptoOptions: CryptoOptions = {
		public_key: publicKey,
		hmac_secret: secretKey
	};

	const accessTokenOptions: TokenOptions = {
		system_type: 0xF, // API
		token_type: 0x1, // OAuth Access,
		pid: pnid.pid,
		access_level: pnid.access_level,
		title_id: BigInt(0),
		expire_time: BigInt(Date.now() + (3600 * 1000))
	};

	const refreshTokenOptions: TokenOptions = {
		system_type: 0xF, // API
		token_type: 0x2, // OAuth Refresh,
		pid: pnid.pid,
		access_level: pnid.access_level,
		title_id: BigInt(0),
		expire_time: BigInt(Date.now() + (3600 * 1000))
	};

	const accessToken: string | null = await generateToken(cryptoOptions, accessTokenOptions);
	const newRefreshToken: string | null = await generateToken(cryptoOptions, refreshTokenOptions);

	// TODO - Handle null tokens

	response.json({
		access_token: accessToken,
		token_type: 'Bearer',
		expires_in: 3600,
		refresh_token: newRefreshToken
	});
});

export default router;