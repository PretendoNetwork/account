const database = require('../dist/database');
const { NEXAccount } = require('../dist/models/nex-account');

database.connect().then(async function () {
	const nexAccountsTotal = await NEXAccount.find({});
	const nexAccounts3DS = await NEXAccount.find({ device_type: '3ds' });
	const nexAccountsWiiU = await NEXAccount.find({ device_type: 'wiiu' });
	const nexAccountsToBeChanged = await NEXAccount.find({
		device_type: {
			$exists: false
		}
	});

	console.log('NEX accounts (Total):', nexAccountsTotal.length);
	console.log('NEX accounts (3DS):', nexAccounts3DS.length);
	console.log('NEX accounts (WiiU):', nexAccountsWiiU.length);
	console.log('NEX accounts (To be changed):', nexAccountsToBeChanged.length);

	for (const nexAccount of nexAccountsToBeChanged) {
		if (nexAccount.owning_pid !== nexAccount.pid) {
			// 3DS account
			nexAccount.device_type = '3ds';
		} else {
			// WiiU account
			nexAccount.device_type = 'wiiu';
		}

		await nexAccount.save();
	}

	console.log('Migrated accounts');

	process.exit(0);
});
