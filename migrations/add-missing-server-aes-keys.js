const crypto = require('node:crypto');
const database = require('../dist/database');
const { Server } = require('../dist/models/server');

database.connect().then(async function () {
	const servers = await Server.find({
		aes_key: {
			$exists: false
		}
	});

	for (const server of servers) {

		if (!server.aes_key) {
			server.aes_key = crypto.randomBytes(32).toString('hex');

			await server.save();
		}
	}

	console.log('Migrated accounts');

	process.exit(0);
});