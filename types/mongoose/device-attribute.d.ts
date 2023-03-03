import { Document, Model } from 'mongoose';

declare global {
	interface IDeviceAttributeDocument extends Document {
		created_date: string;
		name: string;
		value: string;
	}

	interface IDeviceAttribute extends IDeviceAttributeDocument {}

	interface IDeviceAttributeModel extends Model<IDeviceAttribute> {}
}