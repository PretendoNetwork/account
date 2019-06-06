const router = require('express').Router();
const json2xml = require('json2xml');
const bcrypt = require('bcrypt');
const nintendoClientHeaderCheck = require('../middleware/nintendoClientHeaderCheck');

/**
 * [POST]
 * Replacement for: https://account.nintendo.net/v1/api/oauth20/access_token/generate
 * Description: Generates an access token for a user
 */
router.post('/access_token/generate', nintendoClientHeaderCheck, async (request, response) => {
	const {body: postData} = request;
	const {grant_type, refresh_token, user_id, password} = postData;

	if (!(grant_type === 'password' || grant_type === 'refresh_token')) {
		response.status(400);
		return response.send(json2xml({
			error: {
				cause: 'grant_type',
				code: '0004',
				message: 'Invalid Grant Type'
			}
		}));
	}

	if (!user_id || user_id.trim() === '') {
		response.status(400);
		return response.send(json2xml({
			error: {
				cause: 'user_id',
				code: '0002',
				message: 'user_id format is invalid'
			}
		}));
	}

	if (!password || password.trim() === '') {
		response.status(400);
		return response.send(json2xml({
			error: {
				cause: 'password',
				code: '0002',
				message: 'password format is invalid'
			}
		}));
	}

	const user = await request.database.getUserByUsername(user_id);

	if (!user || !bcrypt.compareSync(password, user.password)) {
		response.status(400);
		return response.send(json2xml({
			error: {
				code: '0106',
				message: 'Invalid account ID or password'
			}
		}));
	}

	let access_token;
	let refresh_token_;

	switch (grant_type) {
		case 'password':
			[access_token, refresh_token_] = await user.generateAccessTokens();
			break;
		case 'refresh_token':
			console.log('Handle refresh of token:', refresh_token);
			break;
	
		default:
			break;
	}

	response.send(json2xml({
		OAuth20: {
			access_token: {
				token: access_token,
				refresh_token: refresh_token_,
				expires_in: 3600
			}
		}
	}));
});

module.exports = router;