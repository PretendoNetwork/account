const crypto = require('node:crypto');
const database = require('../dist/database');
const { NEXAccount } = require('../dist/models/nex-account');

database.connect().then(async function () {
	const nexAccounts3DS = await NEXAccount.find({
		device_type: '3ds',
		friend_code: {
			$exists: false
		}
	});

	for (const nexAccount of nexAccounts3DS) {

		if (!nexAccount.friend_code) {
			const pid = nexAccount.pid;
			const pidBuffer = Buffer.alloc(4);
			pidBuffer.writeUInt32LE(pid);

			const hash = crypto.createHash('sha1').update(pidBuffer);
			const pidHash = hash.digest();
			const checksum = pidHash[0] >> 1;
			const hex = checksum.toString(16) + pid.toString(16);
			const int = parseInt(hex, 16);
			const friendCode = int.toString().padStart(12, '0').match(/.{1,4}/g).join('-');

			nexAccount.friend_code = friendCode;

			await nexAccount.save();
		}
	}

	console.log('Migrated accounts');

	process.exit(0);
});