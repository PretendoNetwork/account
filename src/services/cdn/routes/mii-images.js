const router = require('express').Router();
const fs = require('fs-extra');
const path = require('path');

router.get('/:pid/:image', async (request, response) => {
	const { pid, image } = request.params;
	const userMiiImagePath = path.normalize(`${__dirname}/../../../../cdn/${pid}/miis/${image}`);
	console.log(userMiiImagePath);

	if (fs.existsSync(userMiiImagePath)) {
		response.sendFile(userMiiImagePath);
	} else {
		response.sendStatus(404);
	}
});

module.exports = router;