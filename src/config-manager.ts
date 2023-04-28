import fs from 'fs-extra';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { LOG_INFO, LOG_WARN, LOG_ERROR } from '@/logger';
import { Config, DisabledFeatures } from '@/types/common/config';

dotenv.config();

export const disabledFeatures: DisabledFeatures = {
	redis: false,
	email: false,
	captcha: false,
	s3: false
};

LOG_INFO('Loading config');

let mongooseConnectOptions: mongoose.ConnectOptions = {};

if (process.env.PN_ACT_CONFIG_MONGOOSE_CONNECT_OPTIONS_PATH) {
	mongooseConnectOptions = fs.readJSONSync(process.env.PN_ACT_CONFIG_MONGOOSE_CONNECT_OPTIONS_PATH);
}

if (process.env.PN_ACT_CONFIG_EMAIL_SECURE) {
	if (process.env.PN_ACT_CONFIG_EMAIL_SECURE !== 'true' && process.env.PN_ACT_CONFIG_EMAIL_SECURE !== 'false') {
		LOG_ERROR(`PN_ACT_CONFIG_EMAIL_SECURE must be either true or false, got ${process.env.PN_ACT_CONFIG_EMAIL_SECURE}`);
		process.exit(0);
	}
}

export const config: Config = {
	http: {
		port: Number(process.env.PN_ACT_CONFIG_HTTP_PORT || '')
	},
	mongoose: {
		connection_string: process.env.PN_ACT_CONFIG_MONGO_CONNECTION_STRING || '',
		options: mongooseConnectOptions
	},
	redis: {
		client: {
			url: process.env.PN_ACT_CONFIG_REDIS_URL || ''
		}
	},
	email: {
		host: process.env.PN_ACT_CONFIG_EMAIL_HOST || '',
		port: Number(process.env.PN_ACT_CONFIG_EMAIL_PORT || ''),
		secure: (process.env.PN_ACT_CONFIG_EMAIL_SECURE || '') === 'true',
		auth: {
			user: process.env.PN_ACT_CONFIG_EMAIL_USERNAME || '',
			pass: process.env.PN_ACT_CONFIG_EMAIL_PASSWORD || ''
		},
		from: process.env.PN_ACT_CONFIG_EMAIL_FROM || ''
	},
	s3: {
		endpoint: process.env.PN_ACT_CONFIG_S3_ENDPOINT || '',
		key: process.env.PN_ACT_CONFIG_S3_ACCESS_KEY || '',
		secret: process.env.PN_ACT_CONFIG_S3_ACCESS_SECRET || ''
	},
	hcaptcha: {
		secret: process.env.PN_ACT_CONFIG_HCAPTCHA_SECRET || ''
	},
	cdn: {
		subdomain: process.env.PN_ACT_CONFIG_CDN_SUBDOMAIN || '',
		disk_path: process.env.PN_ACT_CONFIG_CDN_DISK_PATH || '',
		base_url: process.env.PN_ACT_CONFIG_CDN_BASE_URL || ''
	},
	website_base: process.env.PN_ACT_CONFIG_WEBSITE_BASE || '',
	aes_key: process.env.PN_ACT_CONFIG_AES_KEY || '',
	grpc: {
		api_key: process.env.PN_ACT_CONFIG_GRPC_API_KEY || '',
		port: Number(process.env.PN_ACT_CONFIG_GRPC_PORT || ''),
	}
};

LOG_INFO('Config loaded, checking integrity');

if (!config.http.port) {
	LOG_ERROR('Failed to find HTTP port. Set the PN_ACT_CONFIG_HTTP_PORT environment variable');
	process.exit(0);
}

if (!config.mongoose.connection_string) {
	LOG_ERROR('Failed to find MongoDB connection string. Set the PN_ACT_CONFIG_MONGO_CONNECTION_STRING environment variable');
	process.exit(0);
}

if (!config.cdn.base_url) {
	LOG_ERROR('Failed to find asset CDN base URL. Set the PN_ACT_CONFIG_CDN_BASE_URL environment variable');
	process.exit(0);
}

if (!config.redis.client.url) {
	LOG_WARN('Failed to find Redis connection url. Disabling feature and using in-memory cache. To enable feature set the PN_ACT_CONFIG_REDIS_URL environment variable');
	disabledFeatures.redis = true;
}

if (!config.email.host) {
	LOG_WARN('Failed to find email SMTP host. Disabling feature. To enable feature set the PN_ACT_CONFIG_EMAIL_HOST environment variable');
	disabledFeatures.email = true;
}

if (!config.email.port) {
	LOG_WARN('Failed to find email SMTP port. Disabling feature. To enable feature set the PN_ACT_CONFIG_EMAIL_PORT environment variable');
	disabledFeatures.email = true;
}

if (config.email.secure === undefined) {
	LOG_WARN('Failed to find email SMTP secure flag. Disabling feature. To enable feature set the PN_ACT_CONFIG_EMAIL_SECURE environment variable');
	disabledFeatures.email = true;
}

if (!config.email.auth.user) {
	LOG_WARN('Failed to find email account username. Disabling feature. To enable feature set the auth.user environment variable');
	disabledFeatures.email = true;
}

if (!config.email.auth.pass) {
	LOG_WARN('Failed to find email account password. Disabling feature. To enable feature set the PN_ACT_CONFIG_EMAIL_PASSWORD environment variable');
	disabledFeatures.email = true;
}

if (!config.email.from) {
	LOG_WARN('Failed to find email from config. Disabling feature. To enable feature set the PN_ACT_CONFIG_EMAIL_FROM environment variable');
	disabledFeatures.email = true;
}

if (!disabledFeatures.email) {
	if (!config.website_base) {
		LOG_ERROR('Email sending is enabled and no website base was configured. Set the PN_ACT_CONFIG_WEBSITE_BASE environment variable');
		process.exit(0);
	}
}

if (!config.hcaptcha.secret) {
	LOG_WARN('Failed to find captcha secret config. Disabling feature. To enable feature set the PN_ACT_CONFIG_HCAPTCHA_SECRET environment variable');
	disabledFeatures.captcha = true;
}

if (!config.s3.endpoint) {
	LOG_WARN('Failed to find s3 endpoint config. Disabling feature. To enable feature set the PN_ACT_CONFIG_S3_ENDPOINT environment variable');
	disabledFeatures.s3 = true;
}

if (!config.s3.key) {
	LOG_WARN('Failed to find s3 access key config. Disabling feature. To enable feature set the PN_ACT_CONFIG_S3_ACCESS_KEY environment variable');
	disabledFeatures.s3 = true;
}

if (!config.s3.secret) {
	LOG_WARN('Failed to find s3 secret key config. Disabling feature. To enable feature set the PN_ACT_CONFIG_S3_ACCESS_SECRET environment variable');
	disabledFeatures.s3 = true;
}

if (disabledFeatures.s3) {
	if (!config.cdn.subdomain) {
		LOG_ERROR('s3 file storage is disabled and no CDN subdomain was set. Set the PN_ACT_CONFIG_CDN_SUBDOMAIN environment variable');
		process.exit(0);
	}

	if (!config.cdn.disk_path) {
		LOG_ERROR('s3 file storage is disabled and no CDN disk path was set. Set the PN_ACT_CONFIG_CDN_DISK_PATH environment variable');
		process.exit(0);
	}

	LOG_WARN(`s3 file storage disabled. Using disk-based file storage. Please ensure cdn.base_url config or PN_ACT_CONFIG_CDN_BASE env variable is set to point to this server with the subdomain being ${config.cdn.subdomain}`);

	if (disabledFeatures.redis) {
		LOG_WARN('Both s3 and Redis are disabled. Large CDN files will use the in-memory cache, which may result in high memory use. Please enable s3 if you\'re running a production server.');
	}
}

if (!config.aes_key) {
	LOG_ERROR('Token AES key is not set. Set the PN_ACT_CONFIG_AES_KEY environment variable to your AES-256-CBC key');
	process.exit(0);
}

if (!config.grpc.api_key) {
	LOG_ERROR('gRPC API key is not set. Set the PN_ACT_CONFIG_GRPC_API_KEY environment variable');
	process.exit(0);
}

if (!config.grpc.port) {
	LOG_ERROR('Failed to find gRPC port. Set the PN_ACT_CONFIG_GRPC_PORT environment variable');
	process.exit(0);
}