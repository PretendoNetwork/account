import express from 'express';
import xmlbuilder from 'xmlbuilder';
import bcrypt from 'bcrypt';
import fs from 'fs-extra';
import { getUserByUsername } from '@/database';
import { generateToken } from '@/util';
import { TokenOptions } from '@/types/common/token-options';
import { HydratedPNIDDocument } from '@/types/mongoose/pnid';

const router: express.Router = express.Router();

/**
 * [POST]
 * Replacement for: https://account.nintendo.net/v1/api/oauth20/access_token/generate
 * Description: Generates an access token for a user
 */
router.post('/access_token/generate', async (request: express.Request, response: express.Response) => {
	const grantType: string = request.body?.grant_type;
	const username: string = request.body?.user_id;
	const password: string = request.body?.password;

	if (!['password', 'refresh_token'].includes(grantType)) {
		response.status(400);
		return response.send(xmlbuilder.create({
			error: {
				cause: 'grant_type',
				code: '0004',
				message: 'Invalid Grant Type'
			}
		}).end());
	}

	if (!username || username.trim() === '') {
		response.status(400);
		return response.send(xmlbuilder.create({
			error: {
				cause: 'user_id',
				code: '0002',
				message: 'user_id format is invalid'
			}
		}).end());
	}

	if (!password || password.trim() === '') {
		response.status(400);
		return response.send(xmlbuilder.create({
			error: {
				cause: 'password',
				code: '0002',
				message: 'password format is invalid'
			}
		}).end());
	}

	const pnid: HydratedPNIDDocument | null = await getUserByUsername(username);

	if (!pnid || !await bcrypt.compare(password, pnid.password)) {
		response.status(400);
		return response.send(xmlbuilder.create({
			error: {
				code: '0106',
				message: 'Invalid account ID or password'
			}
		}).end({ pretty: true }));
	}

	if (pnid.get('access_level') < 0) {
		return response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					code: '0122',
					message: 'Device has been banned by game server'
				}
			}
		}).end());
	}

	const cryptoPath: string = `${__dirname}/../../../../certs/service/account`;

	if (!await fs.pathExists(cryptoPath)) {
		// Need to generate keys
		return response.send(xmlbuilder.create({
			errors: {
				error: {
					code: '0000',
					message: 'Could not find account access key crypto path'
				}
			}
		}).end());
	}

	const accessTokenOptions: TokenOptions = {
		system_type: 0x1, // WiiU
		token_type: 0x1, // OAuth Access,
		pid: pnid.get('pid'),
		expire_time: BigInt(Date.now() + (3600 * 1000))
	};

	const refreshTokenOptions: TokenOptions = {
		system_type: 0x1, // WiiU
		token_type: 0x2, // OAuth Refresh,
		pid: pnid.get('pid'),
		expire_time: BigInt(Date.now() + (3600 * 1000))
	};

	let accessToken: string | null = await generateToken(null, accessTokenOptions);
	let refreshToken: string | null = await generateToken(null, refreshTokenOptions);

	// TODO - Handle null tokens

	if (request.isCemu) {
		accessToken = Buffer.from(accessToken || '', 'base64').toString('hex');
		refreshToken = Buffer.from(refreshToken || '', 'base64').toString('hex');
	}

	response.send(xmlbuilder.create({
		OAuth20: {
			access_token: {
				token: accessToken,
				refresh_token: refreshToken,
				expires_in: 3600
			}
		}
	}).end());
});

export default router;