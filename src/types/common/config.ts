import mongoose from 'mongoose';

export interface Config {
	http: {
		port: number;
	};
	mongoose: {
		connection_string: string;
		options: mongoose.ConnectOptions;
	};
	redis: {
		client: {
			url: string;
		}
	};
	email: {
		host: string;
		port: number;
		secure: boolean;
		auth: {
			user: string;
			pass: string;
		};
		from: string;
	};
	s3: {
		endpoint: string;
		key: string;
		secret: string;
	};
	hcaptcha: {
		secret: string;
	};
	cdn: {
		subdomain: string;
		disk_path: string;
		base_url: string;
	};
	website_base: string;
	aes_key: string;
	grpc: {
		api_key: string;
		port: number;
	};
	stripe?: {
		secret_key: string;
	};
}

export interface DisabledFeatures {
	redis: boolean;
	email: boolean;
	captcha: boolean;
	s3: boolean
}