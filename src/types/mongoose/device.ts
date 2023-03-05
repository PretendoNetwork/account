import { Model } from 'mongoose';
import { DeviceAttributeSchema } from '@/models/device';

type MODEL = 'wup' | 'ctr' | 'spr' | 'ftr' | 'ktr' | 'red' | 'jan';
type ACCESS_LEVEL = 0 | 1 | 2 | 3;
type SERVER_ACCESS_LEVEL = 'prod' | 'test' | 'dev';

export interface IDevice {
	is_emulator: boolean;
	model: MODEL;
	device_id: number;
	device_type: number;
	serial: string;
	device_attributes: typeof DeviceAttributeSchema[];
	soap: {
		token: string;
		account_id: number;
	},
	// * 3DS-specific stuff
	environment: string;
	mac_hash: string;
	fcdcert_hash: string;
	linked_pids: number[];
	access_level: ACCESS_LEVEL;
	server_access_level: SERVER_ACCESS_LEVEL;
}

export interface IDeviceMethods {}

export interface DeviceModel extends Model<IDevice, {}, IDeviceMethods> {}