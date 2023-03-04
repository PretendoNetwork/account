import { Schema, model } from 'mongoose';

export const DeviceAttributeSchema = new Schema<IDeviceAttribute, DeviceAttributeModel, IDeviceAttributeMethods>({
	created_date: String,
	name: String,
	value: String
});

export const DeviceAttribute: DeviceAttributeModel = model<IDeviceAttribute, DeviceAttributeModel>('DeviceAttribute', DeviceAttributeSchema);

export const DeviceSchema = new Schema<IDevice, DeviceModel, IDeviceMethods>({
	is_emulator: {
		type: Boolean,
		default: false
	},
	model: {
		type: String,
		enum: [
			'wup', // Nintendo Wii U
			'ctr', // Nintendo 3DS
			'spr', // Nintendo 3DS XL
			'ftr', // Nintendo 2DS
			'ktr', // New Nintendo 3DS
			'red', // New Nintendo 3DS XL
			'jan'  // New Nintendo 2DS XL
		]
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
	environment: String,
	mac_hash: String,
	fcdcert_hash: String,
	linked_pids: [Number],
	access_level: {
		type: Number,
		default: 0  // 0: standard, 1: tester, 2: mod?, 3: dev
	},
	server_access_level: {
		type: String,
		default: 'prod' // everyone is in production by default
	}
});

export const Device: DeviceModel = model<IDevice, DeviceModel>('Device', DeviceSchema);

export default {
	DeviceSchema,
	Device,
	DeviceAttributeSchema,
	DeviceAttribute
};