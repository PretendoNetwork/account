import dns from 'node:dns';
import express from 'express';
import xmlbuilder from 'xmlbuilder';
import moment from 'moment';
import { getPNIDByPID } from '@/database';
import { sendEmailConfirmedEmail, sendConfirmationEmail, sendForgotPasswordEmail } from '@/util';
import { HydratedPNIDDocument } from '@/types/mongoose/pnid';

const router: express.Router = express.Router();

/**
 * [POST]
 * Replacement for: https://account.nintendo.net/v1/api/support/validate/email
 * Description: Verifies a provided email address is valid
 */
router.post('/validate/email', async (request: express.Request, response: express.Response): Promise<void> => {
	const email: string = request.body.email;

	if (!email) {
		response.send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'email',
					code: '0103',
					message: 'Email format is invalid'
				}
			}
		}).end());

		return;
	}

	const domain: string = email.split('@')[1];

	dns.resolveMx(domain, (error: NodeJS.ErrnoException | null) => {
		if (error) {
			return response.send(xmlbuilder.create({
				errors: {
					error: {
						code: '1126',
						message: 'The domain "' + domain + '" is not accessible.'
					}
				}
			}).end());
		}

		response.status(200);
		response.end();
	});
});

/**
 * [PUT]
 * Replacement for: https://account.nintendo.net/v1/api/support/email_confirmation/:pid/:code
 * Description: Verifies a users email via 6 digit code
 */
router.put('/email_confirmation/:pid/:code', async (request: express.Request, response: express.Response): Promise<void> => {
	const code: string = request.params.code;
	const pid: number = Number(request.params.pid);

	const pnid: HydratedPNIDDocument | null = await getPNIDByPID(pid);

	if (!pnid) {
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					code: '0130',
					message: 'PID has not been registered yet'
				}
			}
		}).end());

		return;
	}

	if (pnid.identification.email_code !== code) {
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					code: '0116',
					message: 'Missing or invalid verification code'
				}
			}
		}).end());
		return;
	}

	const validatedDate: string = moment().format('YYYY-MM-DDTHH:MM:SS');

	pnid.email.reachable = true;
	pnid.email.validated = true;
	pnid.email.validated_date = validatedDate;

	await pnid.save();

	await sendEmailConfirmedEmail(pnid);

	response.status(200).send('');
});

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/support/resend_confirmation
 * Description: Resends a users confirmation email
 */
router.get('/resend_confirmation', async (request: express.Request, response: express.Response): Promise<void> => {
	const pid: number = Number(request.headers['x-nintendo-pid']);

	const pnid: HydratedPNIDDocument | null = await getPNIDByPID(pid);

	if (!pnid) {
		// TODO - Unsure if this is the right error
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					code: '0130',
					message: 'PID has not been registered yet'
				}
			}
		}).end());

		return;
	}

	await sendConfirmationEmail(pnid);

	response.status(200).send('');
});

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/support/forgotten_password/PID
 * Description: Sends the user a password reset email
 * NOTE: On NN this was a temp password that expired after 24 hours. We do not do that
 */
router.get('/forgotten_password/:pid', async (request: express.Request, response: express.Response): Promise<void> => {
	const pid: number = Number(request.params.pid);

	const pnid: HydratedPNIDDocument | null = await getPNIDByPID(pid);

	if (!pnid) {
		// TODO - Better errors
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'device_id',
					code: '0113',
					message: 'Unauthorized device'
				}
			}
		}).end());

		return;
	}

	await sendForgotPasswordEmail(pnid);

	response.status(200).send('');
});

export default router;