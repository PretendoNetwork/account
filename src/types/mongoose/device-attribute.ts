import { Model } from 'mongoose';

export interface IDeviceAttribute {
	created_date?: string;
	name: string;
	value: string;
}

export interface IDeviceAttributeMethods {}

interface IDeviceAttributeQueryHelpers {}

export interface DeviceAttributeModel extends Model<IDeviceAttribute, IDeviceAttributeQueryHelpers, IDeviceAttributeMethods> {}