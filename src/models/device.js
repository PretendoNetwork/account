const { Schema, model } = require('mongoose');

const DeviceAttributeSchema = new Schema({
	created_date: String,
	name: String,
	value: String,
});

const DeviceAttribute = model('DeviceAttribute', DeviceAttributeSchema);

const DeviceSchema = new Schema({
	is_emulator: {
		type: Boolean,
		default: false
	},
	console_type: {
		type: String,
		enum: ['wup', 'ctr', 'spr', 'ftr', 'ktr', 'red', 'jan'] // wup is WiiU, the rest are the 3DS family
	},
	device_id: Number,
	device_type: Number,
	serial: String,
	device_attributes: [DeviceAttributeSchema],
	soap: {
		token: String,
		account_id: Number,
	},
	// 3DS-specific stuff
	mac_hash: String,
	fcdcert_hash: String
});

const Device = model('Device', DeviceSchema);

module.exports = {
	DeviceSchema,
	Device,
	DeviceAttributeSchema,
	DeviceAttribute
};