import { Model, Types, HydratedDocument } from 'mongoose';
import { IDevice } from '@/types/mongoose/device';
import { PNIDPermissionFlag } from '@/types/common/permission-flags';

export interface IPNID {
	deleted: boolean;
	permissions: bigint;
	access_level: number;
	server_access_level: string;
	pid: number;
	creation_date: string;
	updated: string;
	username: string;
	usernameLower: string;
	password: string;
	birthdate: string;
	gender: string;
	country: string;
	language: string;
	email: {
		address: string;
		primary: boolean;
		parent: boolean;
		reachable: boolean;
		validated: boolean;
		validated_date: string;
		id: number;
	};
	region: number;
	timezone: {
		name: string;
		offset: number;
		marketing: boolean;
		off_device: boolean;
	};
	mii: {
		name: string;
		primary: boolean;
		data: string;
		id: number;
		hash: string;
		image_url: string;
		image_id: number;
	};
	flags: {
		active: boolean;
		marketing: boolean;
		off_device: boolean;
	};
	devices: Types.DocumentArray<IDevice>;
	identification: { // * user identification tokens
		email_code: string;
		email_token: string;
		access_token: {
			value: string;
			ttl: number;
		};
		refresh_token: {
			value: string;
			ttl: number;
		}
	};
	connections: {
		discord: {
			id: string;
		};
		stripe: {
			customer_id: string;
			subscription_id: string;
			price_id: string;
			tier_level: number;
			tier_name: string;
			latest_webhook_timestamp: number;
		};
	};
}

export interface IPNIDMethods {
	generatePID(): Promise<void>;
	generateEmailValidationCode(): Promise<void>;
	generateEmailValidationToken(): Promise<void>;
	updateMii(mii: { name: string, primary: string, data: string}): Promise<void>;
	generateMiiImages(): Promise<void>;
	scrub(): Promise<void>;
	hasPermission(flag: PNIDPermissionFlag): boolean;
	addPermission(flag: PNIDPermissionFlag): void;
	clearPermission(flag: PNIDPermissionFlag): void;
}

interface IPNIDQueryHelpers {}

export interface PNIDModel extends Model<IPNID, IPNIDQueryHelpers, IPNIDMethods> {}

export type HydratedPNIDDocument = HydratedDocument<IPNID, IPNIDMethods>