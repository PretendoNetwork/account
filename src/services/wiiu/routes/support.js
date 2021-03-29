const router = require('express').Router();
const dns = require('dns');
const xmlbuilder = require('xmlbuilder');
const clientHeaderCheck = require('../../../middleware/client-header');

router.post('/validate/email', clientHeaderCheck, async (request, response) => {
	// Status should be 2 from previous request in registration process
	if (request.session.registration_status !== 2) {
		response.status(400);

		return response.send(xmlbuilder.create({
			error: {
				cause: 'Bad Request',
				code: '1600',
				message: 'Unable to process request'
			}
		}).end());
	}

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

		request.session.registration_status = 3;

		response.status(200);
		response.end();
	});
});

module.exports = router;