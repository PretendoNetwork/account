const {Schema, model} = require('mongoose');

const DeviceAttributeSchema = new Schema({
	created_date: String,
	name: String,
	value: String,
});

const DeviceAttribute = model('DeviceAttribute', DeviceAttributeSchema);

module.exports = {
	DeviceAttributeSchema,
	DeviceAttribute
};