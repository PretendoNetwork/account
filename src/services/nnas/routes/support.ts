import dns from 'node:dns';
import express from 'express';
import xmlbuilder from 'xmlbuilder';
import moment from 'moment';
import { getPNIDByEmailAddress, getPNIDByPID } from '@/database';
import { Device } from '@/models/device';
import { sendEmailConfirmedEmail, sendConfirmationEmail, sendForgotPasswordEmail, sendEmailConfirmedParentalControlsEmail } from '@/util';

// * Middleware to ensure the input device is valid
// TODO - Make this available for more routes? This could be useful elsewhere
async function validateDeviceIDMiddleware(request: express.Request, response: express.Response, next: express.NextFunction): Promise<void> {
	const deviceID = request.header('x-nintendo-device-id');
	const serial = request.header('x-nintendo-serial-number');

	// * Since these values are linked at the time of device creation, and the
	// * device ID is always validated against the device certificate for legitimacy
	// * we can safely assume that every console hitting our servers through normal
	// * means will be stored correctly. And since once both values are set they
	// * cannot be changed, these checks will always be safe
	const device = await Device.findOne({
		device_id: Number(deviceID),
		serial: serial
	});

	if (!device) {
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

	if (device.access_level < 0) {
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					code: '0012',
					message: 'Device has been banned by game server' // TODO - This is not the right error message
				}
			}
		}).end());

		return;
	}

	// TODO - Once we push support for linking PNIDs to consoles, also check if the PID is linked or not

	next();
}

const router = express.Router();

/**
 * [POST]
 * Replacement for: https://account.nintendo.net/v1/api/support/validate/email
 * Description: Verifies a provided email address is valid
 */
router.post('/validate/email', async (request: express.Request, response: express.Response): Promise<void> => {
	const email = request.body.email;

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

	const domain = email.split('@')[1];

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

		response.send();
	});
});

/**
 * [PUT]
 * Replacement for: https://account.nintendo.net/v1/api/support/email_confirmation/:pid/:code
 * Description: Verifies a users email via 6 digit code
 */
router.put('/email_confirmation/:pid/:code', async (request: express.Request, response: express.Response): Promise<void> => {
	const code = request.params.code;
	const pid = Number(request.params.pid);

	const pnid = await getPNIDByPID(pid);

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

	// * If the email is already confirmed don't bother continuing
	if (pnid.email.validated) {
		// TODO - Is there an actual error for this case?
		response.status(200).send('');
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

	const validatedDate = moment().format('YYYY-MM-DDTHH:MM:SS');

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
router.get('/resend_confirmation', validateDeviceIDMiddleware, async (request: express.Request, response: express.Response): Promise<void> => {
	const pid = Number(request.headers['x-nintendo-pid']);

	const pnid = await getPNIDByPID(pid);

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

	// * If the email is already confirmed don't bother continuing
	if (pnid.email.validated) {
		// TODO - Is there an actual error for this case?
		response.status(200).send('');
		return;
	}

	await sendConfirmationEmail(pnid);

	response.status(200).send('');
});

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/support/send_confirmation/pin/:email
 * Description: Sends a users confirmation email that their email has been registered for parental controls
 */
router.get('/send_confirmation/pin/:email', async (request: express.Request, response: express.Response): Promise<void> => {
	const email = request.params.email;

	const pnid = await getPNIDByEmailAddress(email);

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

	await sendEmailConfirmedParentalControlsEmail(pnid);

	response.status(200).send('');
});

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/support/forgotten_password/PID
 * Description: Sends the user a password reset email
 * NOTE: On NN this was a temp password that expired after 24 hours. We do not do that
 */
router.get('/forgotten_password/:pid', validateDeviceIDMiddleware, async (request: express.Request, response: express.Response): Promise<void> => {
	if (!/^\d+$/.test(request.params.pid)) {
		// * This is what Nintendo sends
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'Not Found',
					code: '1600',
					message: 'Unable to process request'
				}
			}
		}).end());

		return;
	}

	const pid = Number(request.params.pid);
	const pnid = await getPNIDByPID(pid);

	if (!pnid) {
		// * Whenever a PID is a number, but is invalid, Nintendo just 404s
		// TODO - When we move to linking PNIDs to consoles, this also applies to valid PIDs not linked to the current console
		response.status(404).send('');
		return;
	}

	await sendForgotPasswordEmail(pnid);

	response.status(200).send('');
});

export default router;
