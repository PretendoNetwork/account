const router = require('express').Router();
const xmlbuilder = require('xmlbuilder');

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/devices/@current/status
 * Description: Unknown use
 */
router.get('/@current/status', async (request, response) => {
	response.send(xmlbuilder.create({
		device: ''
	}).end());
});

module.exports = router;