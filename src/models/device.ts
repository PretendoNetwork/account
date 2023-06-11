import { Schema, model } from 'mongoose';
import { IDeviceAttribute, IDeviceAttributeMethods, DeviceAttributeModel } from '@/types/mongoose/device-attribute';
import { IDevice, IDeviceMethods, DeviceModel } from '@/types/mongoose/device';

const DeviceAttributeSchema = new Schema<IDeviceAttribute, DeviceAttributeModel, IDeviceAttributeMethods>({
	created_date: String,
	name: String,
	value: String
});

export const DeviceSchema = new Schema<IDevice, DeviceModel, IDeviceMethods>({
	is_emulator: {
		type: Boolean,
		default: false
	},
	model: {
		type: String,
		enum: [
			'wup', // * Nintendo Wii U
			'ctr', // * Nintendo 3DS
			'spr', // * Nintendo 3DS XL
			'ftr', // * Nintendo 2DS
			'ktr', // * New Nintendo 3DS
			'red', // * New Nintendo 3DS XL
			'jan'  // * New Nintendo 2DS XL
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
	environment: String,
	mac_hash: String,     // * 3DS-specific
	fcdcert_hash: String, // * 3DS-specific
	linked_pids: [Number],
	access_level: {
		type: Number,
		default: 0  // 0: standard, 1: tester, 2: mod?, 3: dev
	},
	server_access_level: {
		type: String,
		default: 'prod' // everyone is in production by default
	},
	certificate_hash: String
});

export const Device: DeviceModel = model<IDevice, DeviceModel>('Device', DeviceSchema);