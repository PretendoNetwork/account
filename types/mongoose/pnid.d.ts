import { Document, Model } from 'mongoose';
import { DeviceSchema } from '../../src/models/device';

declare global {
	interface IPNIDDocument extends Document {
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
		devices: typeof DeviceSchema[];
		identification: { // user identification tokens
			email_code: string;
			email_token: string;
			access_token: {
				value: string;
				ttl: number;
			},
			refresh_token: {
				value: string;
				ttl: number;
			}
		};
		connections: {
			discord: {
				id: string;
			}
		};
	}

	interface IPNID extends IPNIDDocument {
		generatePID(): void;
		generateEmailValidationCode(): void;
		generateEmailValidationToken(): void;
		updateMii(mii: { name: string, primary: boolean, data: Buffer}): void;
		generateMiiImages(): void;
		getServerMode(): string;
	}

	interface IPNIDModel extends Model<IPNID> {
		generatePID(): void;
		generateEmailValidationToken(): void;
	}
}