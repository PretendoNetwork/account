import { Model } from 'mongoose';

declare global {
	interface IDeviceAttribute {
		created_date: string;
		name: string;
		value: string;
	}

	interface IDeviceAttributeMethods {}

	interface DeviceAttributeModel extends Model<IDeviceAttribute, {}, IDeviceAttributeMethods> {}
}