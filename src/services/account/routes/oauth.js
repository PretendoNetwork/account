const router = require('express').Router();
const xmlbuilder = require('xmlbuilder');
const bcrypt = require('bcrypt');
const fs = require('fs-extra');
const clientHeaderCheck = require('../../../middleware/client-header');
const database = require('../../../database');
const util = require('../../../util');

/**
 * [POST]
 * Replacement for: https://account.nintendo.net/v1/api/oauth20/access_token/generate
 * Description: Generates an access token for a user
 */
router.post('/access_token/generate', clientHeaderCheck, async (request, response) => {
	const titleId = request.headers['x-nintendo-title-id'];
	const { body } = request;
	const { grant_type, user_id, password } = body;

	if (!['password', 'refresh_token'].includes(grant_type)) {
		response.status(400);
		return response.send(xmlbuilder.create({
			error: {
				cause: 'grant_type',
				code: '0004',
				message: 'Invalid Grant Type'
			}
		}).end());
	}

	if (!user_id || user_id.trim() === '') {
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

	const pnid = await database.getUserByUsername(user_id);

	if (!pnid || !bcrypt.compareSync(password, pnid.password)) {
		response.status(400);
		return response.send(xmlbuilder.create({
			error: {
				code: '0106',
				message: 'Invalid account ID or password'
			}
		}).end());
	}

	const cryptoPath = `${__dirname}/../../../../certs/access`;

	if (!fs.pathExistsSync(cryptoPath)) {
		// Need to generate keys
		return response.send(xmlbuilder.create({
			errors: {
				error: {
					code: '0000',
					message: 'Could not find access key crypto path'
				}
			}
		}).end());
	}

	const publicKey = fs.readFileSync(`${cryptoPath}/public.pem`);
	const hmacSecret = fs.readFileSync(`${cryptoPath}/secret.key`);

	const cryptoOptions = {
		public_key: publicKey,
		hmac_secret: hmacSecret
	};

	const accessTokenOptions = {
		system_type: 0x1, // WiiU
		token_type: 0x1, // OAuth Access,
		pid: pnid.get('pid'),
		title_id: BigInt(parseInt(titleId, 16)),
		date: BigInt(Date.now())
	};

	const refreshTokenOptions = {
		system_type: 0x1, // WiiU
		token_type: 0x2, // OAuth Refresh,
		pid: pnid.get('pid'),
		title_id: BigInt(parseInt(titleId, 16)),
		date: BigInt(Date.now())
	};

	const accessToken = util.generateToken(cryptoOptions, accessTokenOptions);
	const refreshToken = util.generateToken(cryptoOptions, refreshTokenOptions);

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

module.exports = router;