import express from 'express';
import validator from 'validator';
import hcaptcha from 'hcaptcha';
import { getPNIDByEmailAddress, getPNIDByUsername } from '@/database';
import { sendForgotPasswordEmail } from '@/util';
import { config, disabledFeatures } from '@/config-manager';
import { HydratedPNIDDocument } from '@/types/mongoose/pnid';

const router = express.Router();

router.post('/', async (request: express.Request, response: express.Response): Promise<void> => {
	const input = request.body?.input;
	const hCaptchaResponse = request.body.hCaptchaResponse?.trim();

	if (!disabledFeatures.captcha) {
		if (!hCaptchaResponse || hCaptchaResponse === '') {
			response.status(400).json({
				app: 'api',
				status: 400,
				error: 'Must fill in captcha',
			});

			return;
		}

		const captchaVerify = await hcaptcha.verify(
			config.hcaptcha.secret,
			hCaptchaResponse
		);

		if (!captchaVerify.success) {
			response.status(400).json({
				app: 'api',
				status: 400,
				error: 'Captcha verification failed',
			});

			return;
		}
	}

	if (!input || input.trim() === '') {
		response.status(400).json({
			app: 'api',
			status: 400,
			error: 'Invalid or missing input'
		});

		return;
	}

	let pnid: HydratedPNIDDocument | null;

	if (validator.isEmail(input)) {
		pnid = await getPNIDByEmailAddress(input);
	} else {
		pnid = await getPNIDByUsername(input);
	}

	if (pnid) {
		console.log('API forgot password for', pnid);
		await sendForgotPasswordEmail(pnid);
	}

	response.json({
		app: 'api',
		status: 200
	});
});

export default router;