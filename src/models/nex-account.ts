import { Schema, model } from 'mongoose';
import uniqueValidator from 'mongoose-unique-validator';

export const NEXAccountSchema = new Schema<INEXAccount>({
	device_type: {
		type: String,
		enum: [
			// Only track the family here not the model
			'wiiu',
			'3ds',
		]
	},
	pid: {
		type: Number,
		unique: true
	},
	password: String,
	owning_pid: Number,
	access_level: {
		type: Number,
		default: 0  // 0: standard, 1: tester, 2: mod?, 3: dev
	},
	server_access_level: {
		type: String,
		default: 'prod' // everyone is in production by default
	}
});

NEXAccountSchema.plugin(uniqueValidator, { message: '{PATH} already in use.' });

/*
	According to http://pf2m.com/tools/rank.php Nintendo PID's start at 1,800,000,000 and count down with each account
	This means the max PID is 1799999999 and hard-limits the number of potential accounts to 1,800,000,000
	The author of that site does not give any information on how they found this out, but it does seem to hold true
	https://account.nintendo.net/v1/api/admin/mapped_ids?input_type=pid&output_type=user_id&input=1800000000 returns nothing
	https://account.nintendo.net/v1/api/admin/mapped_ids?input_type=pid&output_type=user_id&input=1799999999 returns `prodtest1`
	and the next few accounts counting down seem to be admin, service and internal test accounts
*/
NEXAccountSchema.methods.generatePID = async function () {
	const min = 1000000000; // The console (WiiU) seems to not accept PIDs smaller than this
	const max = 1799999999;

	let pid = Math.floor(Math.random() * (max - min + 1) + min);

	const inuse = await NEXAccount.findOne({ pid });

	if (inuse) {
		await NEXAccount.generatePID();
	} else {
		this.set('pid', pid);
	}
};

NEXAccountSchema.methods.generatePassword = function () {
	function character() {
		const offset = Math.floor(Math.random() * 62);
		if (offset < 10) return offset;
		if (offset < 36) return String.fromCharCode(offset + 55);
		return String.fromCharCode(offset + 61);
	}

	const output = [];

	while (output.length < 16) {
		output.push(character());
	}

	this.set('password', output.join(''));
};

export const NEXAccount: INEXAccountModel = model<INEXAccount, INEXAccountModel>('NEXAccount', NEXAccountSchema);

export default {
	NEXAccountSchema,
	NEXAccount
};