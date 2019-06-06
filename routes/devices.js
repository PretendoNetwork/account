const router = require('express').Router();
const json2xml = require('json2xml');
const nintendoClientHeaderCheck = require('../middleware/nintendoClientHeaderCheck');

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/devices/@current/status
 * Description: Unknown use
 */
router.get('/@current/status', nintendoClientHeaderCheck, async (request, response) => {
	return response.send(json2xml({device: null}));
});

module.exports = router;