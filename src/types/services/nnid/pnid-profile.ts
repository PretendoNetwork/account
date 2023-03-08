import { YesNoBoolString } from '@/types/common/yes-no-bool-string';

export interface PNIDProfile {
	//accounts: {}; // * We need to figure this out; no idea what these values mean or what they do
	active_flag: YesNoBoolString;
	birth_date: string;
	country: string;
	create_date: string;
	device_attributes: [{
		device_attribute: {
			name: string;
			value: string;
			created_date: string;
		};
	}];
	gender: string;
	language: string;
	updated: string;
	marketing_flag: YesNoBoolString;
	off_device_flag: YesNoBoolString;
	pid: number;
	email: {
		address: string;
		id: string;
		parent: YesNoBoolString;
		primary: YesNoBoolString;
		reachable: YesNoBoolString;
		type: 'DEFAULT';
		updated_by: 'USER'; // * Can also be INTERNAL WS; don't know the difference
		validated: YesNoBoolString;
		validated_date: string;
	};
	mii: {
		status: 'COMPLETED';
		data: string;
		id: number;
		mii_hash: string;
		mii_images: {
			mii_image: {
				cached_url: string;
				id: string;
				url: string;
				type: 'standard';
			}
		};
		name: string;
		primary: YesNoBoolString;
	};
	region: number;
	tz_name: string;
	user_id: string;
	utc_offset: number;
}