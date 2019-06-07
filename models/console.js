const {Schema, model} = require('mongoose');
const {DeviceAttributeSchema} = require('./deviceattribute');

const ConsoleSchema = new Schema({
	is_emulator: {
		type: Boolean,
		default: false
	},
	console_type: {
		type: String,
		enum: ['wup', 'ctr', 'spr', 'ftr', 'ktr', 'red', 'jan'] // wup is WiiU, the rest are the 3DS family. Only wup is used atm
	},
	device_id: Number,
	device_type: Number,
	serial: String,
	device_attributes: [DeviceAttributeSchema]
});

const Console = model('Console', ConsoleSchema);

module.exports = {
	ConsoleSchema,
	Console
};