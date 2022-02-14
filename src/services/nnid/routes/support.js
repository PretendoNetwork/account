const router = require('express').Router();
const dns = require('dns');
const xmlbuilder = require('xmlbuilder');

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

module.exports = router;