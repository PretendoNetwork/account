const router = require('express').Router();
const cache = require('../../../cache');

router.get('/*', async (request, response) => {
	const filePath = request.params[0];

	const file = await cache.getLocalCDNFile(filePath);

	if (file) {
		response.send(file);
	} else {
		response.sendStatus(404);
	}
});

module.exports = router;