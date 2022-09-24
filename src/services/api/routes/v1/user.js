const router = require('express').Router();
const { PNID } = require('../../../../models/pnid');
const config = require('../../../../config.json');

/**
 * [GET]
 * Implementation of for: https://api.pretendo.cc/v1/user
 * Description: Gets PNID details about the current user
 */
router.get('/', async (request, response) => {
	const { pnid } = request;

	if (!pnid) {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid or missing access token'
		});
	}

	return response.json({
		access_level: pnid.get('access_level'),
		server_access_level: pnid.get('server_access_level'),
		pid: pnid.get('pid'),
		creation_date: pnid.get('creation_date'),
		updated: pnid.get('updated'),
		username: pnid.get('username'),
		birthdate: pnid.get('birthdate'),
		gender: pnid.get('gender'),
		country: pnid.get('country'),
		email: {
			address: pnid.get('email.address'),
		},
		timezone: {
			name: pnid.get('timezone.name')
		},
		mii: {
			data: pnid.get('mii.data'),
			name: pnid.get('mii.name'),
			image_url: `${config.cdn_base}/mii/${pnid.get('pid')}/normal_face.png`
		},
		flags: {
			marketing: pnid.get('flags.marketing')
		},
		connections: {
			discord: {
				id: pnid.get('connections.discord.id')
			}
		}
	});
});

/**
 * [POST]
 * Implementation of for: https://api.pretendo.cc/v1/user
 * Description: Updates PNID certain details about the current user
 */
router.post('/', async (request, response) => {
	const { body, pnid } = request;

	if (!pnid) {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid or missing access token'
		});
	}

	if (body.mii && typeof body.mii === 'object' && body.mii.name && body.mii.primary && body.mii.data) {
		const name = body.mii.name;
		const primary = body.mii.primary;
		const data = body.mii.data;

		await pnid.updateMii({ name, primary, data });
	}

	const { pid } = pnid;

	const updateData = {};

	await PNID.updateOne({ pid }, { $set: updateData }).exec();

	return response.json({
		access_level: pnid.get('access_level'),
		server_access_level: pnid.get('server_access_level'),
		pid: pnid.get('pid'),
		creation_date: pnid.get('creation_date'),
		updated: pnid.get('updated'),
		username: pnid.get('username'),
		birthdate: pnid.get('birthdate'),
		gender: pnid.get('gender'),
		country: pnid.get('country'),
		email: {
			address: pnid.get('email.address'),
		},
		timezone: {
			name: pnid.get('timezone.name')
		},
		mii: {
			data: pnid.get('mii.data'),
			name: pnid.get('mii.name'),
			image_url: `https://pretendo-cdn.b-cdn.net/mii/${pnid.get('pid')}/normal_face.png`
		},
		flags: {
			marketing: pnid.get('flags.marketing')
		},
		connections: {
			discord: {
				id: pnid.get('connections.discord.id')
			}
		}
	});
});

module.exports = router;