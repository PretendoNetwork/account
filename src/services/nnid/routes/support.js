const router = require('express').Router();
const dns = require('dns');
const xmlbuilder = require('xmlbuilder');
const moment = require('moment');
const util = require('../../../util');
const database = require('../../../database');

/**
 * [POST]
 * Replacement for: https://account.nintendo.net/v1/api/support/validate/email
 * Description: Verifies a provided email address is valid
 */
router.post('/validate/email', async (request, response) => {
	const { email } = request.body;

	if (!email) {
		return response.send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'email',
					code: '0103',
					message: 'Email format is invalid'
				}
			}
		}).end());
	}

	const domain = email.split('@')[1];

	dns.resolveMx(domain, (error) => {
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
router.put('/email_confirmation/:pid/:code', async (request, response) => {
	const { pid, code } = request.params;

	const pnid = await database.getUserByPID(pid);

	if (!pnid) {
		return response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					code: '0130',
					message: 'PID has not been registered yet'
				}
			}
		}).end());
	}

	if (pnid.get('identification.email_code') !== code) {
		return response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					code: '0116',
					message: 'Missing or invalid verification code'
				}
			}
		}).end());
	}

	const validatedDate = moment().format('YYYY-MM-DDTHH:MM:SS');

	pnid.set('email.reachable', true);
	pnid.set('email.validated', true);
	pnid.set('email.validated_date', validatedDate);

	await pnid.save();

	await util.sendEmailConfirmedEmail(pnid);

	response.status(200).send('');
});

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/support/resend_confirmation
 * Description: Resends a users confirmation email
 */
router.get('/resend_confirmation', async (request, response) => {
	const pid = request.headers['x-nintendo-pid'];

	const pnid = await database.getUserByPID(pid);

	if (!pnid) {
		// TODO - Unsure if this is the right error
		return response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					code: '0130',
					message: 'PID has not been registered yet'
				}
			}
		}).end());
	}

	await util.sendConfirmationEmail(pnid);

	response.status(200).send('');
});

module.exports = router;