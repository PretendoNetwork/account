import { Model, Types, HydratedDocument } from 'mongoose';
import { IDeviceAttribute } from '@/types/mongoose/device-attribute';

type MODEL = 'wup' | 'ctr' | 'spr' | 'ftr' | 'ktr' | 'red' | 'jan';
type ACCESS_LEVEL = 0 | 1 | 2 | 3;
type SERVER_ACCESS_LEVEL = 'prod' | 'test' | 'dev';

export interface IDevice {
	is_emulator: boolean;
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
	mac_hash: string;
	fcdcert_hash: string;
	linked_pids: number[];
	access_level: ACCESS_LEVEL;
	server_access_level: SERVER_ACCESS_LEVEL;
}

export interface IDeviceMethods {}

interface IDeviceQueryHelpers {}

export interface DeviceModel extends Model<IDevice, IDeviceQueryHelpers, IDeviceMethods> {}

export type HydratedDeviceDocument = HydratedDocument<IDevice, IDeviceMethods>