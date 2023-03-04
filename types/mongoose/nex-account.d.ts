import { Model } from 'mongoose';

type DEVICE = 'wiiu' | '3ds';
type ACCESS_LEVEL = 0 | 1 | 2 | 3;

declare global {
	interface INEXAccount {
		device_type: DEVICE;
		pid: number;
		password: string;
		owning_pid: number;
		access_level: ACCESS_LEVEL;
		server_access_level: string;
	}

	interface INEXAccountMethods {
		generatePID(): Promise<void>;
		generatePassword(): void;
	}

	interface NEXAccountModel extends Model<INEXAccount, {}, INEXAccountMethods> {}
}