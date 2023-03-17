import express from 'express';
import joi from 'joi';
//import { PNID } from '@/models/pnid';
import { config } from '@/config-manager';
import { HydratedPNIDDocument } from '@/types/mongoose/pnid';
import { UpdateUserRequest } from '@/types/services/api/update-user-request';

const router: express.Router = express.Router();

// TODO: Extend this later with more settings
const userSchema: joi.ObjectSchema = joi.object({
	mii: joi.object({
		name: joi.string(),
		primary: joi.string(),
		data: joi.string(),
	})
});

/**
 * [GET]
 * Implementation of for: https://api.pretendo.cc/v1/user
 * Description: Gets PNID details about the current user
 */
router.get('/', async (request: express.Request, response: express.Response) => {
	const pnid: HydratedPNIDDocument = request.pnid;

	if (!pnid) {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid or missing access token'
		});
	}

	return response.json({
		access_level: pnid.access_level,
		server_access_level: pnid.server_access_level,
		pid: pnid.pid,
		creation_date: pnid.creation_date,
		updated: pnid.updated,
		username: pnid.username,
		birthdate: pnid.birthdate,
		gender: pnid.gender,
		country: pnid.country,
		email: {
			address: pnid.email.address,
		},
		timezone: {
			name: pnid.timezone.name
		},
		mii: {
			data: pnid.mii.data,
			name: pnid.mii.name,
			image_url: `${config.cdn.base_url}/mii/${pnid.pid}/normal_face.png`
		},
		flags: {
			marketing: pnid.flags.marketing
		},
		connections: {
			discord: {
				id: pnid.connections.discord.id
			}
		}
	});
});

/**
 * [POST]
 * Implementation of for: https://api.pretendo.cc/v1/user
 * Description: Updates PNID certain details about the current user
 */
router.post('/', async (request: express.Request, response: express.Response) => {
	const pnid: HydratedPNIDDocument = request.pnid;
	const updateUserRequest: UpdateUserRequest = request.body;

	if (!pnid) {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid or missing access token'
		});
	}

	const valid: joi.ValidationResult = userSchema.validate(updateUserRequest);

	if (valid.error) {
		return response.status(400).json({
			app: 'api',
			status: 400,
			error: valid.error
		});
	}

	// TODO - Make this do something

	//const pid: number = pnid.pid;

	//const updateData = {};

	//await PNID.updateOne({ pid }, { $set: updateData }).exec();

	return response.json({
		access_level: pnid.access_level,
		server_access_level: pnid.server_access_level,
		pid: pnid.pid,
		creation_date: pnid.creation_date,
		updated: pnid.updated,
		username: pnid.username,
		birthdate: pnid.birthdate,
		gender: pnid.gender,
		country: pnid.country,
		email: {
			address: pnid.email.address,
		},
		timezone: {
			name: pnid.timezone.name
		},
		mii: {
			data: pnid.mii.data,
			name: pnid.mii.name,
			image_url: `${config.cdn.base_url}/mii/${pnid.pid}/normal_face.png`
		},
		flags: {
			marketing: pnid.flags.marketing
		},
		connections: {
			discord: {
				id: pnid.connections.discord.id
			}
		}
	});
});

export default router;