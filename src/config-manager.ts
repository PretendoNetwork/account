import fs from 'fs-extra';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { LOG_INFO, LOG_WARN, LOG_ERROR, formatHostnames } from '@/logger';
import { Config, domainServices } from '@/types/common/config';
import isValidHostname from 'is-valid-hostname';

dotenv.config();

export const disabledFeatures = {
	redis: false,
	email: false,
	captcha: false,
	s3: false
};

const hexadecimalStringRegex = /^[0-9a-f]+$/i;

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
		ses: {
			region: process.env.PN_ACT_CONFIG_EMAIL_SES_REGION || '',
			key: process.env.PN_ACT_CONFIG_EMAIL_SES_ACCESS_KEY || '',
			secret: process.env.PN_ACT_CONFIG_EMAIL_SES_SECRET_KEY || ''
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
		subdomain: process.env.PN_ACT_CONFIG_CDN_SUBDOMAIN,
		disk_path: process.env.PN_ACT_CONFIG_CDN_DISK_PATH || '',
		base_url: process.env.PN_ACT_CONFIG_CDN_BASE_URL || ''
	},
	website_base: process.env.PN_ACT_CONFIG_WEBSITE_BASE || '',
	aes_key: process.env.PN_ACT_CONFIG_AES_KEY || '',
	grpc: {
		master_api_keys: {
			account: process.env.PN_ACT_CONFIG_GRPC_MASTER_API_KEY_ACCOUNT || '',
			api: process.env.PN_ACT_CONFIG_GRPC_MASTER_API_KEY_API || '',
		},
		port: Number(process.env.PN_ACT_CONFIG_GRPC_PORT || ''),
	},
	server_environment: process.env.PN_ACT_CONFIG_SERVER_ENVIRONMENT || '',
	datastore: {
		signature_secret: process.env.PN_ACT_CONFIG_DATASTORE_SIGNATURE_SECRET || ''
	},
	domains: {
		api: (process.env.PN_ACT_CONFIG_DOMAINS_API || 'api.pretendo.cc').split(','),
		assets: (process.env.PN_ACT_CONFIG_DOMAINS_ASSETS || 'assets.pretendo.cc').split(','),
		cbvc: (process.env.PN_ACT_CONFIG_DOMAINS_CBVC || 'cbvc.cdn.pretendo.cc').split(','),
		conntest: (process.env.PN_ACT_CONFIG_DOMAINS_CONNTEST || 'conntest.pretendo.cc').split(','),
		datastore: (process.env.PN_ACT_CONFIG_DOMAINS_DATASTORE || 'datastore.pretendo.cc').split(','),
		cdn: (process.env.PN_ACT_CONFIG_DOMAINS_CDN || '').split(',').filter(d => d),
		nasc: (process.env.PN_ACT_CONFIG_DOMAINS_NASC || 'nasc.pretendo.cc').split(','),
		nnas: (process.env.PN_ACT_CONFIG_DOMAINS_NNAS || 'account.pretendo.cc').split(','),
	}
};

if (process.env.PN_ACT_CONFIG_STRIPE_SECRET_KEY) {
	config.stripe = {
		secret_key: process.env.PN_ACT_CONFIG_STRIPE_SECRET_KEY
	};
}

// Add the old config option for backwards compatibility
if (config.cdn.subdomain) {
	config.domains.cdn.push(config.cdn.subdomain);
}

let configValid = true;

LOG_INFO('Config loaded, checking integrity');

for (const service of domainServices) {
	const validDomains: string[] = [];
	const invalidDomains: string[] = [];

	const uniqueDomains = [...new Set(config.domains[service])];

	for (const domain of uniqueDomains) {
		isValidHostname(domain) ? validDomains.push(domain) : invalidDomains.push(domain);
	}

	if (validDomains.length === 0) {
		LOG_ERROR(`No valid domains found for ${service}. Set the PN_ACT_CONFIG_DOMAINS_${service.toUpperCase()} environment variable to a valid domain`);
		configValid = false;
	}

	if (invalidDomains.length) {
		LOG_WARN(`Invalid domain(s) skipped for ${service}: ${formatHostnames(invalidDomains)}`);
	}

	config.domains[service] = validDomains;
}

if (!config.http.port) {
	LOG_ERROR('Failed to find HTTP port. Set the PN_ACT_CONFIG_HTTP_PORT environment variable');
	configValid = false;
}

if (!config.mongoose.connection_string) {
	LOG_ERROR('Failed to find MongoDB connection string. Set the PN_ACT_CONFIG_MONGO_CONNECTION_STRING environment variable');
	configValid = false;
}

if (!config.cdn.base_url) {
	LOG_ERROR('Failed to find asset CDN base URL. Set the PN_ACT_CONFIG_CDN_BASE_URL environment variable');
	configValid = false;
}

if (!config.redis.client.url) {
	LOG_WARN('Failed to find Redis connection url. Disabling feature and using in-memory cache. To enable feature set the PN_ACT_CONFIG_REDIS_URL environment variable');
	disabledFeatures.redis = true;
}

if (!config.email.ses.region) {
	LOG_WARN('Failed to find AWS SES region. Disabling feature. To enable feature set the PN_ACT_CONFIG_EMAIL_SES_REGION environment variable');
	disabledFeatures.email = true;
}

if (!config.email.ses.key) {
	LOG_WARN('Failed to find AWS SES access key. Disabling feature. To enable feature set the PN_ACT_CONFIG_EMAIL_SES_ACCESS_KEY environment variable');
	disabledFeatures.email = true;
}

if (!config.email.ses.secret) {
	LOG_WARN('Failed to find AWS SES secret key. Disabling feature. To enable feature set the PN_ACT_CONFIG_EMAIL_SES_SECRET_KEY environment variable');
	disabledFeatures.email = true;
}

if (!config.email.from) {
	LOG_WARN('Failed to find email from config. Disabling feature. To enable feature set the PN_ACT_CONFIG_EMAIL_FROM environment variable');
	disabledFeatures.email = true;
}

if (!disabledFeatures.email) {
	if (!config.website_base) {
		LOG_ERROR('Email sending is enabled and no website base was configured. Set the PN_ACT_CONFIG_WEBSITE_BASE environment variable');
		configValid = false;
	}
}

if (!config.hcaptcha.secret) {
	LOG_WARN('Failed to find captcha secret config. Disabling feature. To enable feature set the PN_ACT_CONFIG_HCAPTCHA_SECRET environment variable');
	disabledFeatures.captcha = true;
}

if (!config.s3.endpoint) {
	LOG_WARN('Failed to find S3 endpoint config. Disabling feature. To enable feature set the PN_ACT_CONFIG_S3_ENDPOINT environment variable');
	disabledFeatures.s3 = true;
}

if (!config.s3.key) {
	LOG_WARN('Failed to find S3 access key config. Disabling feature. To enable feature set the PN_ACT_CONFIG_S3_ACCESS_KEY environment variable');
	disabledFeatures.s3 = true;
}

if (!config.s3.secret) {
	LOG_WARN('Failed to find S3 secret key config. Disabling feature. To enable feature set the PN_ACT_CONFIG_S3_ACCESS_SECRET environment variable');
	disabledFeatures.s3 = true;
}

if (!config.server_environment) {
	LOG_WARN('Failed to find server environment. To change the environment, set the PN_ACT_CONFIG_SERVER_ENVIRONMENT environment variable. Defaulting to prod');
	config.server_environment = 'prod';
}

if (disabledFeatures.s3) {
	if (config.domains.cdn.length === 0) {
		LOG_ERROR('S3 file storage is disabled and no CDN subdomain was set. Set the PN_ACT_CONFIG_DOMAINS_CDN environment variable');
		configValid = false;
	}

	if (!config.cdn.disk_path) {
		LOG_ERROR('S3 file storage is disabled and no CDN disk path was set. Set the PN_ACT_CONFIG_CDN_DISK_PATH environment variable');
		configValid = false;
	}

	LOG_WARN(`S3 file storage disabled. Using disk-based file storage. Please ensure cdn.base_url config or PN_ACT_CONFIG_CDN_BASE env variable is set to point to this server with the subdomain being ${config.cdn.subdomain}`);

	if (disabledFeatures.redis) {
		LOG_WARN('Both S3 and Redis are disabled. Large CDN files will use the in-memory cache, which may result in high memory use. Please enable S3 if you\'re running a production server.');
	}
}

if (!config.aes_key) {
	LOG_ERROR('Token AES key is not set. Set the PN_ACT_CONFIG_AES_KEY environment variable to your AES-256-CBC key');
	configValid = false;
}

if (!config.grpc.master_api_keys.account) {
	LOG_ERROR('Master gRPC API key for the account service is not set. Set the PN_ACT_CONFIG_GRPC_MASTER_API_KEY_ACCOUNT environment variable');
	configValid = false;
}

if (!config.grpc.master_api_keys.api) {
	LOG_ERROR('Master gRPC API key for the api service is not set. Set the PN_ACT_CONFIG_GRPC_MASTER_API_KEY_API environment variable');
	configValid = false;
}

if (!config.grpc.port) {
	LOG_ERROR('Failed to find gRPC port. Set the PN_ACT_CONFIG_GRPC_PORT environment variable');
	configValid = false;
}

if (!config.stripe?.secret_key) {
	LOG_WARN('Failed to find Stripe api key! If a PNID is deleted with an active subscription, the subscription will *NOT* be canceled! Set the PN_ACT_CONFIG_STRIPE_SECRET_KEY environment variable to enable');
}

if (!config.datastore.signature_secret) {
	LOG_ERROR('Datastore signature secret key is not set. Set the PN_ACT_CONFIG_DATASTORE_SIGNATURE_SECRET environment variable');
	configValid = false;
}
if (config.datastore.signature_secret.length !== 32 || !hexadecimalStringRegex.test(config.datastore.signature_secret)) {
	LOG_ERROR('Datastore signature secret key must be a 32-character hexadecimal string.');
	configValid = false;
}

if (!configValid) {
	LOG_ERROR('Config is invalid. Exiting');
	process.exit(0);
}