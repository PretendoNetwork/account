import express from 'express';
import xmlbuilder from 'xmlbuilder';
import bcrypt from 'bcrypt';
import { getPNIDByNNASRefreshToken, getPNIDByUsername } from '@/database';
import { generateOAuthTokens } from '@/util';
import { createNNASErrorResponse } from '@/services/nnas/create-response';
import { Device } from '@/models/device';
import { SystemType } from '@/types/common/token';

const router = express.Router();

/**
 * [POST]
 * Replacement for: https://account.nintendo.net/v1/api/oauth20/access_token/generate
 * Description: Generates an access token for a user
 */
router.post('/access_token/generate', async (request: express.Request, response: express.Response): Promise<void> => {
	const grantType = request.body.grant_type;
	const username = request.body.user_id;
	const password = request.body.password;
	const refreshToken = request.body.refresh_token;

	if (!['password', 'refresh_token'].includes(grantType)) {
		return createNNASErrorResponse(response, {
			errors: [
				{
					cause: 'grant_type',
					code: '0004',
					message: 'Invalid Grant Type'
				}
			]
		});
	}

	let pnid = null;

	if (grantType === 'password') {
		if (!username || username.trim() === '') {
			return createNNASErrorResponse(response, {
				errors: [
					{
						cause: 'user_id',
						code: '0002',
						message: 'user_id format is invalid'
					}
				]
			});
		}

		if (!password || password.trim() === '') {
			return createNNASErrorResponse(response, {
				errors: [
					{
						cause: 'password',
						code: '0002',
						message: 'password format is invalid'
					}
				]
			});
		}

		pnid = await getPNIDByUsername(username);

		// TODO - Client also sends a password_type field, which is always set to "hashed". If field is missing or not "hashed", assume input password is plain-text
		if (!pnid || !await bcrypt.compare(password, pnid.password)) {
			return createNNASErrorResponse(response, {
				errors: [
					{
						code: '0106',
						message: 'Invalid account ID or password'
					}
				]
			});
		}
	} else {
		if (!refreshToken || refreshToken.trim() === '') {
			return createNNASErrorResponse(response, {
				status: 401,
				errors: [
					{
						cause: 'refresh_token',
						code: '0106',
						message: 'Invalid Refresh Token'
					}
				]
			});
		}

		try {
			pnid = await getPNIDByNNASRefreshToken(refreshToken);

			if (!pnid) {
				return createNNASErrorResponse(response, {
					status: 401,
					errors: [
						{
							cause: 'refresh_token',
							code: '0106',
							message: 'Invalid Refresh Token'
						}
					]
				});
			}
		} catch (error) {
			return createNNASErrorResponse(response, {
				status: 401,
				errors: [
					{
						cause: 'refresh_token',
						code: '0106',
						message: 'Invalid Refresh Token'
					}
				]
			});
		}
	}

	if (pnid.deleted) {
		// * 0112 is the "account deleted" error, but unsure if this unlinks the PNID from the user?
		// * 0143 is the "The link to this Nintendo Network ID has been temporarliy removed" error,
		// * maybe that is a better error to use here?
		return createNNASErrorResponse(response, {
			errors: [
				{
					code: '0112',
					message: pnid.username
				}
			]
		});
	}

	// * This are set/validated in consoleStatusVerificationMiddleware
	// * It is always set, despite what Express might think
	if (request.device?.model === 'wup') {
		await Device.updateOne({
			_id: request.device?._id
		}, {
			$addToSet: {
				linked_pids: pnid.pid
			}
		});
	}

	if (pnid.access_level < 0) {
		return createNNASErrorResponse(response, {
			errors: [
				{
					code: '0108',
					message: 'Account has been banned'
				}
			]
		});
	}

	try {
		const tokenGeneration = generateOAuthTokens(SystemType.WIIU, pnid);

		response.send(xmlbuilder.create({
			OAuth20: {
				access_token: {
					token: tokenGeneration.accessToken,
					refresh_token: tokenGeneration.refreshToken,
					expires_in: tokenGeneration.expiresInSecs.access
				}
			}
		}).commentBefore('WARNING! DO NOT SHARE ANYTHING IN THIS REQUEST OR RESPONSE WITH UNTRUSTED USERS! IT CAN BE USED TO IMPERSONATE YOU AND YOUR CONSOLE, POTENTIALLY GETTING YOU BANNED!').end()); // TODO - This is ugly
	} catch {
		response.status(500);
	}
});

export default router;