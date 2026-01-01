import crypto from 'node:crypto';
import express from 'express';
import xmlbuilder from 'xmlbuilder';
import bcrypt from 'bcrypt';
import deviceCertificateMiddleware from '@/middleware/device-certificate';
import consoleStatusVerificationMiddleware from '@/middleware/console-status-verification';
import { getPNIDByNNASRefreshToken, getPNIDByUsername } from '@/database';
import { SystemType } from '@/types/common/system-types';
import { TokenType } from '@/types/common/token-types';
import { Device } from '@/models/device';
import { OAuthToken } from '@/models/oauth_token';

const router = express.Router();

/**
 * [POST]
 * Replacement for: https://account.nintendo.net/v1/api/oauth20/access_token/generate
 * Description: Generates an access token for a user
 */
router.post('/access_token/generate', deviceCertificateMiddleware, consoleStatusVerificationMiddleware, async (request: express.Request, response: express.Response): Promise<void> => {
	const grantType = request.body.grant_type;
	const username = request.body.user_id;
	const password = request.body.password;
	const refreshToken = request.body.refresh_token;

	if (!['password', 'refresh_token'].includes(grantType)) {
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'grant_type',
					code: '0004',
					message: 'Invalid Grant Type'
				}
			}
		}).end());

		return;
	}

	let pnid = null;

	if (grantType === 'password') {
		if (!username || username.trim() === '') {
			response.status(400).send(xmlbuilder.create({
				errors: {
					error: {
						cause: 'user_id',
						code: '0002',
						message: 'user_id format is invalid'
					}
				}
			}).end());

			return;
		}

		if (!password || password.trim() === '') {
			response.status(400).send(xmlbuilder.create({
				errors: {
					error: {
						cause: 'password',
						code: '0002',
						message: 'password format is invalid'
					}
				}
			}).end());

			return;
		}

		pnid = await getPNIDByUsername(username);

		if (!pnid || !await bcrypt.compare(password, pnid.password)) {
			response.status(400).send(xmlbuilder.create({
				errors: {
					error: {
						code: '0106',
						message: 'Invalid account ID or password'
					}
				}
			}).end({ pretty: true }));

			return;
		}
	} else {
		if (!refreshToken || refreshToken.trim() === '') {
			response.status(400).send(xmlbuilder.create({
				errors: {
					error: {
						cause: 'refresh_token',
						code: '0106',
						message: 'Invalid Refresh Token'
					}
				}
			}).end());

			return;
		}

		try {
			pnid = await getPNIDByNNASRefreshToken(refreshToken);

			if (!pnid) {
				response.status(400).send(xmlbuilder.create({
					errors: {
						error: {
							cause: 'refresh_token',
							code: '0106',
							message: 'Invalid Refresh Token'
						}
					}
				}).end());

				return;
			}
		} catch {
			response.status(400).send(xmlbuilder.create({
				errors: {
					error: {
						cause: 'refresh_token',
						code: '0106',
						message: 'Invalid Refresh Token'
					}
				}
			}).end());

			return;
		}
	}

	if (pnid.deleted) {
		// * 0112 is the "account deleted" error, but unsure if this unlinks the PNID from the user?
		// * 0143 is the "The link to this Nintendo Network ID has been temporarliy removed" error,
		// * maybe that is a better error to use here?
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

	// * This are set/validated in consoleStatusVerificationMiddleware
	// * It is always set, despite what Express might think
	await Device.updateOne({
		_id: request.device!._id
	}, {
		$addToSet: {
			linked_pids: pnid.pid
		}
	});

	if (pnid.access_level < 0) {
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					code: '0108',
					message: 'Account has been banned'
				}
			}
		}).end());

		return;
	}

	const clientID = request.header('x-nintendo-client-id');
	const clientSecret = request.header('x-nintendo-client-secret');

	const accessToken = await OAuthToken.create({
		token: crypto.randomBytes(16).toString('hex'),
		client_id: clientID,
		client_secret: clientSecret,
		pid: pnid.pid,
		info: {
			system_type: SystemType.WUP,
			token_type: TokenType.OAuthAccess,
			title_id: BigInt(0), // TODO - Add this?
			issued: new Date(),
			expires: new Date(Date.now() + 12 * 3600 * 1000)
		}
	});

	const newRefreshToken = await OAuthToken.create({
		token: crypto.randomBytes(20).toString('hex'),
		client_id: clientID,
		client_secret: clientSecret,
		pid: pnid.pid,
		info: {
			system_type: SystemType.WUP,
			token_type: TokenType.OAuthRefresh,
			title_id: BigInt(0), // TODO - Add this?
			issued: new Date(),
			expires: new Date(Date.now() + 12 * 3600 * 1000)
		}
	});

	// TODO - Handle null tokens

	response.send(xmlbuilder.create({
		OAuth20: {
			access_token: {
				token: accessToken.token,
				refresh_token: newRefreshToken.token,
				expires_in: 3600
			}
		}
	}).end());
});

export default router;
