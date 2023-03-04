import { Router } from 'express';
import bcrypt from 'bcrypt';
import fs from 'fs-extra';
import database from '@database';
import cache from '@cache';
import util from '@util';

const router = Router();

/**
 * [POST]
 * Implementation of for: https://api.pretendo.cc/v1/login
 * Description: Generates an access token for an API user
 * TODO: Replace this with a more robust OAuth2 implementation
 */
router.post('/', async (request, response) => {
	const { body } = request;
	const { grant_type, username, password, refresh_token } = body;

	if (!['password', 'refresh_token'].includes(grant_type)) {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid grant type'
		});
	}

	if (grant_type === 'password' && (!username || username.trim() === '')) {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid or missing username'
		});
	}

	if (grant_type === 'password' && (!password || password.trim() === '')) {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid or missing password'
		});
	}

	if (grant_type === 'refresh_token' && (!refresh_token || refresh_token.trim() === '')) {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid or missing refresh token'
		});
	}

	let pnid;
	if (grant_type === 'password') {
		pnid = await database.getUserByUsername(username);
		if (!pnid) {
			return response.status(400).json({
				app: 'api',
				status: 400,
				error: 'User not found'
			});
		}

		const hashedPassword = util.nintendoPasswordHash(password, pnid.get('pid'));

		if (!pnid || !bcrypt.compareSync(hashedPassword, pnid.password)) {
			return response.status(400).json({
				app: 'api',
				status: 400,
				error: 'Invalid or missing password'
			});
		}
	} else {
		pnid = await database.getUserBearer(refresh_token);
		if (!pnid) {
			return response.status(400).json({
				app: 'api',
				status: 400,
				error: 'Invalid or missing refresh token'
			});
		}
	}

	const cryptoPath = `${__dirname}/../../../../../certs/service/account`;

	if (!await fs.pathExists(cryptoPath)) {
		// Need to generate keys
		return response.status(500).json({
			app: 'api',
			status: 500,
			error: 'Failed to locate crypto keys. Please contact an administrator'
		});
	}

	const publicKey = await cache.getServicePublicKey('account');
	const secretKey = await cache.getServiceSecretKey('account');

	const cryptoOptions = {
		public_key: publicKey,
		hmac_secret: secretKey
	};

	const accessTokenOptions = {
		system_type: 0xF, // API
		token_type: 0x1, // OAuth Access,
		pid: pnid.get('pid'),
		access_level: pnid.get('access_level'),
		title_id: BigInt(0),
		expire_time: BigInt(Date.now() + (3600 * 1000))
	};

	const refreshTokenOptions = {
		system_type: 0xF, // API
		token_type: 0x2, // OAuth Refresh,
		pid: pnid.get('pid'),
		access_level: pnid.get('access_level'),
		title_id: BigInt(0),
		expire_time: BigInt(Date.now() + (3600 * 1000))
	};

	const accessToken = await util.generateToken(cryptoOptions, accessTokenOptions);
	const refreshToken = await util.generateToken(cryptoOptions, refreshTokenOptions);

	response.json({
		access_token: accessToken,
		token_type: 'Bearer',
		expires_in: 3600,
		refresh_token: refreshToken
	});
});

export default router;