const router = require('express').Router();
const xmlbuilder = require('xmlbuilder');
const clientHeaderCheck = require('../../../middleware/client-header');

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/devices/@current/status
 * Description: Unknown use
 */
router.get('/@current/status', clientHeaderCheck, async (request, response) => {
	response.send(xmlbuilder.create({
		device: ''
	}).end());
});

module.exports = router;