import express from 'express';
import { z } from 'zod';
import Mii from 'mii-js';
import { config } from '@/config-manager';
import { PNID } from '@/models/pnid';
import { UpdateUserRequest } from '@/types/services/api/update-user-request';

const router = express.Router();

// TODO - Extend this later with more settings
const userSchema = z.object({
	mii: z.object({
		name: z.string().trim(),
		primary: z.enum(['Y', 'N']),
		data: z.string(),
	}).optional(),
	environment: z.enum(['prod', 'test', 'dev']).optional()
});

/**
 * [GET]
 * Implementation of for: https://api.brocatech.com/v1/user
 * Description: Gets PNID details about the current user
 */
router.get('/', async (request: express.Request, response: express.Response): Promise<void> => {
	const pnid = request.pnid;

	if (!pnid) {
		response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid or missing access token'
		});

		return;
	}

	response.json({
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
 * Implementation of for: https://api.brocatech.com/v1/user
 * Description: Updates PNID certain details about the current user
 */
router.post('/', async (request: express.Request, response: express.Response): Promise<void> => {
	const pnid = request.pnid;
	const updateUserRequest: UpdateUserRequest = request.body;

	if (!pnid) {
		response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid or missing access token'
		});

		return;
	}

	const result = userSchema.safeParse(updateUserRequest);

	if (!result.success) {
		response.status(400).json({
			app: 'api',
			status: 400,
			error: result.error
		});

		return;
	}

	if (result.data.mii) {
		const miiNameBuffer = Buffer.from(result.data.mii.name, 'utf16le'); // * UTF8 to UTF16

		if (miiNameBuffer.length < 1) {
			response.status(400).json({
				app: 'api',
				status: 400,
				error: 'Mii name too short'
			});

			return;
		}

		if (miiNameBuffer.length > 0x14) {
			response.status(400).json({
				app: 'api',
				status: 400,
				error: 'Mii name too long'
			});

			return;
		}

		try {
			const miiDataBuffer = Buffer.from(result.data.mii.data, 'base64');

			if (miiDataBuffer.length < 0x60) {
				response.status(400).json({
					app: 'api',
					status: 400,
					error: 'Mii data too short'
				});

				return;
			}

			if (miiDataBuffer.length > 0x60) {
				response.status(400).json({
					app: 'api',
					status: 400,
					error: 'Mii data too long'
				});

				return;
			}

			const mii = new Mii(miiDataBuffer);
			mii.validate();
		} catch (_) {
			response.status(400).json({
				app: 'api',
				status: 400,
				error: 'Failed to decode Mii data'
			});

			return;
		}

		await pnid.updateMii({
			name: result.data.mii.name,
			primary: result.data.mii.primary,
			data: result.data.mii.data
		});
	}

	const updateData: Record<string, any> = {};

	if (result.data.environment) {
		const environment = result.data.environment;

		if (environment === 'test' && pnid.access_level < 1) {
			response.status(400).json({
				app: 'api',
				status: 400,
				error: 'Do not have permission to enter this environment'
			});

			return;
		}

		if (environment === 'dev' && pnid.access_level < 3) {
			response.status(400).json({
				app: 'api',
				status: 400,
				error: 'Do not have permission to enter this environment'
			});

			return;
		}

		updateData.server_access_level = environment;
	}

	await PNID.updateOne({ pid: pnid.pid }, { $set: updateData }).exec();

	response.json({
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