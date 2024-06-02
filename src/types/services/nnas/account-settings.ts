import { GenderTypes } from '@/types/common/gender-types';

export interface AccountSettings {
	birthdate: string;
	gender: GenderTypes;
	tz_name: string;
	region: number;
	email: string;
	server_selection: string;
	marketing_flag: boolean;
	off_device_flag: boolean;
}
