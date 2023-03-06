import fs from 'fs-extra';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import logger from '@/logger';
import { Config, DisabledFeatures } from '@/types/common/config';

dotenv.config();

export const disabledFeatures: DisabledFeatures = {
	redis: false,
	email: false,
	captcha: false,
	s3: false
};

logger.info('Loading config');

let mongooseConnectOptions: mongoose.ConnectOptions;

if (process.env.PN_ACT_CONFIG_MONGOOSE_CONNECT_OPTIONS_PATH) {
	mongooseConnectOptions = fs.readJSONSync(process.env.PN_ACT_CONFIG_MONGOOSE_CONNECT_OPTIONS_PATH);
}

export const config: Config = {
	http: {
		port: Number(process.env.PN_ACT_CONFIG_HTTP_PORT)
	},
	mongoose: {
		connection_string: process.env.PN_ACT_CONFIG_MONGO_CONNECTION_STRING,
		options: mongooseConnectOptions
	},
	redis: {
		client: {
			url: process.env.PN_ACT_CONFIG_REDIS_URL
		}
	},
	email: {
		host: process.env.PN_ACT_CONFIG_EMAIL_HOST,
		port: Number(process.env.PN_ACT_CONFIG_EMAIL_PORT),
		secure: Boolean(process.env.PN_ACT_CONFIG_EMAIL_SECURE),
		auth: {
			user: process.env.PN_ACT_CONFIG_EMAIL_USERNAME,
			pass: process.env.PN_ACT_CONFIG_EMAIL_PASSWORD
		},
		from: process.env.PN_ACT_CONFIG_EMAIL_FROM
	},
	s3: {
		endpoint: process.env.PN_ACT_CONFIG_S3_ENDPOINT,
		key: process.env.PN_ACT_CONFIG_S3_ACCESS_KEY,
		secret: process.env.PN_ACT_CONFIG_S3_ACCESS_SECRET
	},
	hcaptcha: {
		secret: process.env.PN_ACT_CONFIG_HCAPTCHA_SECRET
	},
	cdn: {
		subdomain: process.env.PN_ACT_CONFIG_CDN_SUBDOMAIN,
		disk_path: process.env.PN_ACT_CONFIG_CDN_DISK_PATH,
		base_url: process.env.PN_ACT_CONFIG_CDN_BASE_URL
	},
	website_base: process.env.PN_ACT_CONFIG_WEBSITE_BASE
};

logger.info('Config loaded, checking integrity');

if (!config.http.port) {
	logger.error('Failed to find HTTP port. Set the PN_ACT_CONFIG_HTTP_PORT environment variable');
	process.exit(0);
}

if (!config.mongoose.connection_string) {
	logger.error('Failed to find MongoDB connection string. Set the PN_ACT_CONFIG_MONGO_CONNECTION_STRING environment variable');
	process.exit(0);
}

if (!config.cdn.base_url) {
	logger.error('Failed to find asset CDN base URL. Set the PN_ACT_CONFIG_CDN_BASE_URL environment variable');
	process.exit(0);
}

if (!config.redis.client.url) {
	logger.warn('Failed to find Redis connection url. Disabling feature and using in-memory cache. To enable feature set the PN_ACT_CONFIG_REDIS_URL environment variable');
	disabledFeatures.redis = true;
}

if (!config.email.host) {
	logger.warn('Failed to find email SMTP host. Disabling feature. To enable feature set the PN_ACT_CONFIG_EMAIL_HOST environment variable');
	disabledFeatures.email = true;
}

if (!config.email.port) {
	logger.warn('Failed to find email SMTP port. Disabling feature. To enable feature set the PN_ACT_CONFIG_EMAIL_PORT environment variable');
	disabledFeatures.email = true;
}

if (config.email.secure === undefined) {
	logger.warn('Failed to find email SMTP secure flag. Disabling feature. To enable feature set the PN_ACT_CONFIG_EMAIL_SECURE environment variable');
	disabledFeatures.email = true;
}

if (!config.email.auth.user) {
	logger.warn('Failed to find email account username. Disabling feature. To enable feature set the auth.user environment variable');
	disabledFeatures.email = true;
}

if (!config.email.auth.pass) {
	logger.warn('Failed to find email account password. Disabling feature. To enable feature set the PN_ACT_CONFIG_EMAIL_PASSWORD environment variable');
	disabledFeatures.email = true;
}

if (!config.email.from) {
	logger.warn('Failed to find email from config. Disabling feature. To enable feature set the PN_ACT_CONFIG_EMAIL_FROM environment variable');
	disabledFeatures.email = true;
}

if (!disabledFeatures.email) {
	if (!config.website_base) {
		logger.error('Email sending is enabled and no website base was configured. Set the PN_ACT_CONFIG_WEBSITE_BASE environment variable');
		process.exit(0);
	}
}

if (!config.hcaptcha.secret) {
	logger.warn('Failed to find captcha secret config. Disabling feature. To enable feature set the PN_ACT_CONFIG_HCAPTCHA_SECRET environment variable');
	disabledFeatures.captcha = true;
}

if (!config.s3.endpoint) {
	logger.warn('Failed to find s3 endpoint config. Disabling feature. To enable feature set the PN_ACT_CONFIG_S3_ENDPOINT environment variable');
	disabledFeatures.s3 = true;
}

if (!config.s3.key) {
	logger.warn('Failed to find s3 access key config. Disabling feature. To enable feature set the PN_ACT_CONFIG_S3_ACCESS_KEY environment variable');
	disabledFeatures.s3 = true;
}

if (!config.s3.secret) {
	logger.warn('Failed to find s3 secret key config. Disabling feature. To enable feature set the PN_ACT_CONFIG_S3_ACCESS_SECRET environment variable');
	disabledFeatures.s3 = true;
}

if (disabledFeatures.s3) {
	if (!config.cdn.subdomain) {
		logger.error('s3 file storage is disabled and no CDN subdomain was set. Set the PN_ACT_CONFIG_CDN_SUBDOMAIN environment variable');
		process.exit(0);
	}

	if (!config.cdn.disk_path) {
		logger.error('s3 file storage is disabled and no CDN disk path was set. Set the PN_ACT_CONFIG_CDN_DISK_PATH environment variable');
		process.exit(0);
	}

	logger.warn(`s3 file storage disabled. Using disk-based file storage. Please ensure cdn.base_url config or PN_ACT_CONFIG_CDN_BASE env variable is set to point to this server with the subdomain being ${config.cdn.subdomain}`);

	if (disabledFeatures.redis) {
		logger.warn('Both s3 and Redis are disabled. Large CDN files will use the in-memory cache, which may result in high memory use. Please enable s3 if you\'re running a production server.');
	}
}

export default {
	config,
	disabledFeatures
};