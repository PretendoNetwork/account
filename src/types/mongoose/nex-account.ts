import { Model, HydratedDocument } from 'mongoose';

type DEVICE = 'wiiu' | '3ds';
type ACCESS_LEVEL = 0 | 1 | 2 | 3;

export interface INEXAccount {
	device_type: DEVICE;
	pid: number;
	password: string;
	owning_pid: number;
	access_level: ACCESS_LEVEL;
	server_access_level: string;
}

export interface INEXAccountMethods {
	generatePID(): Promise<void>;
	generatePassword(): void;
}

interface INEXAccountQueryHelpers {}

export interface NEXAccountModel extends Model<INEXAccount, INEXAccountQueryHelpers, INEXAccountMethods> {}

export type HydratedNEXAccountDocument = HydratedDocument<INEXAccount, INEXAccountMethods>