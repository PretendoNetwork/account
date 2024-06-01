import { Model, Types, HydratedDocument } from 'mongoose';
import { IDeviceAttribute } from '@/types/mongoose/device-attribute';

type MODEL = 'wup' | 'ctr' | 'spr' | 'ftr' | 'ktr' | 'red' | 'jan';
type ACCESS_LEVEL = -1 | 0 | 1 | 2 | 3;
type SERVER_ACCESS_LEVEL = 'prod' | 'test' | 'dev';

export interface IDevice {
	model: MODEL;
	device_id: number;
	device_type: number;
	serial: string;
	device_attributes: Types.DocumentArray<IDeviceAttribute>;
	soap: {
		token: string;
		account_id: number;
	};
	environment: string;
	mac_hash: string;     // * 3DS-specific
	fcdcert_hash: string; // * 3DS-specific
	linked_pids: number[];
	access_level: ACCESS_LEVEL;
	server_access_level: SERVER_ACCESS_LEVEL;
	certificate_hash: string;
}

export interface IDeviceMethods {}

interface IDeviceQueryHelpers {}

export interface DeviceModel extends Model<IDevice, IDeviceQueryHelpers, IDeviceMethods> {}

export type HydratedDeviceDocument = HydratedDocument<IDevice, IDeviceMethods>
