import express from 'express';
import { LOG_ERROR } from '@/logger';
import { NEXAccount } from '@/models/nex-account';

const router = express.Router();

/**
 * [POST]
 * Implementation of: https://api.pretendo.cc/v1/repair-uidhmac
 * Description: Creates a new user PNID
 */
router.post('/', async (request: express.Request, response: express.Response): Promise<void> => {
	const pid = request.body.pid?.trim(); // * This has to be forwarded since this request comes from the websites server
	const nexPassword = request.body.password?.trim();

	if (!pid || pid === '' || !/^\d+$/.test(pid)) {
		response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid PID format'
		});

		return;
	}

	if (!nexPassword || !/^[0-9A-Za-z]{16}$/.test(nexPassword)) {
		response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid NEX password format'
		});

		return;
	}

	try {
		const nexAccount = await NEXAccount.findOne({
			pid: parseInt(pid),
			password: nexPassword
		});

		if (!nexAccount) {
			response.json({
				app: 'api',
				status: 400,
				error: 'Invalid NEX account'
			});

			return;
		}

		nexAccount.generateUIDHMAC();

		response.json({
			app: 'api',
			status: 200,
			data: {
				uidhmac: nexAccount.uidhmac
			}
		});
	} catch (error: any) {
		LOG_ERROR('[POST] /v1/repair-uidhmac: ' + error);
		if (error.stack) {
			console.error(error.stack);
		}

		response.status(500).json({
			app: 'api',
			status: 500,
			error: 'Internal server error'
		});

		return;
	}
});

export default router;
