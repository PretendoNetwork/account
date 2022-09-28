const database = require('../../src/database');
const { NEXAccount } = require('../../src/models/nex-account');

database.connect().then(async function () {
	const nexAccounts = await NEXAccount.find({});
	const nexAccounts3DS = await NEXAccount.find({ device_type: '3ds' });
	const nexAccountsWiiU = await NEXAccount.find({ device_type: 'wiiu' });

	console.log('NEX accounts:', nexAccounts.length);
	console.log('NEX accounts (3DS):', nexAccounts3DS.length);
	console.log('NEX accounts (WiiU):', nexAccountsWiiU.length);

	for (const nexAccount of nexAccounts) {
		let deviceType = '';

		if (nexAccount.owning_pid !== nexAccount.pid) {
			// 3DS account
			deviceType = '3ds';
		} else {
			// WiiU account
			deviceType = 'wiiu';
		}

		nexAccount.device_type = deviceType;

		await nexAccount.save();
	}

	console.log('Migrated accounts');

	process.exit(0);
});