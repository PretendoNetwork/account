import { Document, Model } from 'mongoose';

type DEVICE = 'wiiu' | '3ds';
type ACCESS_LEVEL = 0 | 1 | 2 | 3;

declare global {
	interface INEXAccountDocument extends Document {
		device_type: DEVICE;
		pid: number;
		password: string;
		owning_pid: number;
		access_level: ACCESS_LEVEL;
		server_access_level: string;
	}

	interface INEXAccount extends INEXAccountDocument {
		generatePID(): void;
	}

	interface INEXAccountModel extends Model<INEXAccount> {
		generatePID(): void;
	}
}