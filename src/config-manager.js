const fs = require('fs-extra');
const get = require('lodash.get');
const set = require('lodash.set');
const logger = require('./logger');

require('dotenv').config();

/**
 * @typedef {Object} Config
 * @property {object} http HTTP server settings
 * @property {number} http.port HTTP port the server will listen on
 * @property {object} mongoose Mongose connection settings
 * @property {string} mongoose.connection_string MongoDB connection string
 * @property {object} mongoose.options MongoDB connection options
 * @property {object} [redis] redis settings
 * @property {string} [redis.client] redis client settings
 * @property {string} [redis.client.url] redis server URL
 * @property {object} [email] node-mailer client settings
 * @property {string} [email.host] SMTP server address
 * @property {number} [email.port] SMTP server port
 * @property {boolean} [email.secure] Secure SMTP
 * @property {string} [email.from] Email 'from' name/address
 * @property {object} [email.auth] Email authentication settings
 * @property {string} [email.auth.user] Email username
 * @property {string} [email.auth.pass] Email password
 * @property {object} [s3] s3 client settings
 * @property {object} [s3.endpoint] s3 endpoint URL
 * @property {string} [s3.key] s3 access key
 * @property {string} [s3.secret] s3 access secret
 * @property {object} [hcaptcha] hCaptcha settings
 * @property {string} [hcaptcha.secret] hCaptcha secret
 * @property {object} cdn CDN config settings
 * @property {object} [cdn.subdomain] Subdomain used for serving CDN contents when s3 is disabled
 * @property {string} [cdn.disk_path] Fully qualified file system path for storing and reading local CDN contents
 * @property {string} cdn.base_url Base URL for CDN server
 * @property {string} website_base Base URL for service website (used with emails)
 */

/**
 * @type {Config}
 */
let config = {};

/**
 * @typedef {Object} DisabledFeatures
 * @property {boolean} redis true if redis is disabled
 * @property {boolean} email true if email sending is disabled
 * @property {boolean} captcha true if captcha verification is disabled
 * @property {boolean} s3 true if s3 services is disabled
 */

/**
 * @type {DisabledFeatures}
 */
const disabledFeatures = {
	redis: false,
	email: false,
	captcha: false,
	s3: false
};

const requiredFields = [
	['http.port', 'PN_ACT_CONFIG_HTTP_PORT', Number],
	['mongoose.connection_string', 'PN_ACT_CONFIG_MONGO_CONNECTION_STRING'],
	['cdn.base_url', 'PN_ACT_CONFIG_CDN_BASE_URL']
];

function configure() {
	const usingEnv = process.env.PN_ACT_PREFER_ENV_CONFIG === 'true';

	if (usingEnv) {
		logger.info('Loading config from environment variable');

		config = {
			http: {
				port: Number(process.env.PN_ACT_CONFIG_HTTP_PORT)
			},
			mongoose: {
				connection_string: process.env.PN_ACT_CONFIG_MONGO_CONNECTION_STRING,
				options: Object.keys(process.env)
					.filter(key => key.startsWith('PN_ACT_CONFIG_MONGOOSE_OPTION_'))
					.reduce((obj, key) => {
						obj[key.split('_').pop()] = process.env[key];
						return obj;
					}, {})
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
	} else {
		logger.info('Loading config from config.json');

		if (!fs.pathExistsSync(`${__dirname}/../config.json`)) {
			logger.error('Failed to locate config.json file');
			process.exit(0);
		}

		config = require(`${__dirname}/../config.json`);
	}

	logger.info('Config loaded, checking integrity');

	// * Check for required settings
	for (const requiredField of requiredFields) {
		const [keyPath, env, convertType] = requiredField;

		const configValue = get(config, keyPath);
		const envValue = get(process.env, keyPath);

		if (!configValue || (typeof configValue === 'string' && configValue.trim() === '')) {
			if (!envValue || envValue.trim() === '') {
				logger.error(`Failed to locate required field ${keyPath}. Set ${keyPath} in config.json or the ${env} environment variable`);

				process.exit(0);
			} else {
				logger.info(`${keyPath} not found in config, using environment variable ${env}`);

				const newValue = envValue;

				set(config, keyPath, convertType ? convertType(newValue) : newValue);
			}
		}
	}

	// * Check for optional settings

	const redisCheck = get(config, 'redis.client.url');

	if (!redisCheck || redisCheck.trim() === '') {
		if (usingEnv) {
			logger.warn('Failed to find Redis connection url. Disabling feature and using in-memory cache. To enable feature set the PN_ACT_CONFIG_REDIS_URL environment variable');

		} else {
			logger.warn('Failed to find Redis connection url. Disabling feature and using in-memory cache. To enable feature set redis.client.url in your config.json');

		}

		disabledFeatures.redis = true;
	}

	const emailHostCheck = get(config, 'email.host');

	if (!emailHostCheck || emailHostCheck.trim() === '') {
		if (usingEnv) {
			logger.warn('Failed to find email SMTP host. Disabling feature. To enable feature set the PN_ACT_CONFIG_EMAIL_HOST environment variable');
		} else {
			logger.warn('Failed to find email SMTP host. Disabling feature. To enable feature set email.host in your config.json');
		}


		disabledFeatures.email = true;
	}

	const emailPortCheck = get(config, 'email.port');

	if (!emailPortCheck) {
		if (usingEnv) {
			logger.warn('Failed to find email SMTP port. Disabling feature. To enable feature set the PN_ACT_CONFIG_EMAIL_PORT environment variable');
		} else {
			logger.warn('Failed to find email SMTP port. Disabling feature. To enable feature set email.port in your config.json');
		}

		disabledFeatures.email = true;
	}

	const emailSecureCheck = get(config, 'email.secure');

	if (emailSecureCheck === undefined) {
		if (usingEnv) {
			logger.warn('Failed to find email SMTP secure flag. Disabling feature. To enable feature set the PN_ACT_CONFIG_EMAIL_SECURE environment variable');
		} else {

			logger.warn('Failed to find email SMTP secure flag. Disabling feature. To enable feature set email.secure in your config.json');
		}

		disabledFeatures.email = true;
	}

	const emailUsernameCheck = get(config, 'email.auth.user');

	if (!emailUsernameCheck || emailUsernameCheck.trim() === '') {
		if (usingEnv) {
			logger.warn('Failed to find email account username. Disabling feature. To enable feature set the auth.user environment variable');
		} else {

			logger.warn('Failed to find email account username. Disabling feature. To enable feature set email.auth.user in your config.json');
		}

		disabledFeatures.email = true;
	}

	const emailPasswordCheck = get(config, 'email.auth.pass');

	if (!emailPasswordCheck || emailPasswordCheck.trim() === '') {
		if (usingEnv) {
			logger.warn('Failed to find email account password. Disabling feature. To enable feature set the PN_ACT_CONFIG_EMAIL_PASSWORD environment variable');
		} else {

			logger.warn('Failed to find email account password. Disabling feature. To enable feature set email.auth.pass in your config.json');
		}

		disabledFeatures.email = true;
	}

	const emailFromCheck = get(config, 'email.from');

	if (!emailFromCheck || emailFromCheck.trim() === '') {
		if (usingEnv) {
			logger.warn('Failed to find email from config. Disabling feature. To enable feature set the PN_ACT_CONFIG_EMAIL_FROM environment variable');
		} else {

			logger.warn('Failed to find email from config. Disabling feature. To enable feature set email.from in your config.json');
		}

		disabledFeatures.email = true;
	}

	if (!disabledFeatures.email) {
		const websiteBaseCheck = get(config, 'website_base');

		if (!websiteBaseCheck || websiteBaseCheck.trim() === '') {
			if (usingEnv) {
				logger.error('Email sending is enabled and no website base was configured. Set the PN_ACT_CONFIG_WEBSITE_BASE environment variable');
			} else {
				logger.error('Email sending is enabled and no website base was configured. Set website_base in your config.json');
			}

			process.exit(0);
		}
	}

	const captchaSecretCheck = get(config, 'hcaptcha.secret');

	if (!captchaSecretCheck || captchaSecretCheck.trim() === '') {
		if (usingEnv) {
			logger.warn('Failed to find captcha secret config. Disabling feature. To enable feature set the PN_ACT_CONFIG_HCAPTCHA_SECRET environment variable');
		} else {
			logger.warn('Failed to find captcha secret config. Disabling feature. To enable feature set hcaptcha.secret in your config.json');
		}

		disabledFeatures.captcha = true;
	}

	const s3EndpointCheck = get(config, 's3.endpoint');

	if (!s3EndpointCheck || s3EndpointCheck.trim() === '') {
		if (usingEnv) {
			logger.warn('Failed to find s3 endpoint config. Disabling feature. To enable feature set the PN_ACT_CONFIG_S3_ENDPOINT environment variable');
		} else {
			logger.warn('Failed to find s3 endpoint config. Disabling feature. To enable feature set s3.endpoint in your config.json');
		}

		disabledFeatures.s3 = true;
	} else {
	}

	const s3AccessKeyCheck = get(config, 's3.key');

	if (!s3AccessKeyCheck || s3AccessKeyCheck.trim() === '') {
		if (usingEnv) {
			logger.warn('Failed to find s3 access key config. Disabling feature. To enable feature set the PN_ACT_CONFIG_S3_ACCESS_KEY environment variable');
		} else {
			logger.warn('Failed to find s3 access key config. Disabling feature. To enable feature set s3.key in your config.json');
		}

		disabledFeatures.s3 = true;
	}

	const s3SecretKeyCheck = get(config, 's3.secret');

	if (!s3SecretKeyCheck || s3SecretKeyCheck.trim() === '') {
		if (usingEnv) {
			logger.warn('Failed to find s3 secret key config. Disabling feature. To enable feature set the PN_ACT_CONFIG_S3_ACCESS_SECRET environment variable');
		} else {
			logger.warn('Failed to find s3 secret key config. Disabling feature. To enable feature set s3.secret in your config.json');
		}

		disabledFeatures.s3 = true;
	}

	if (disabledFeatures.s3) {
		const cdnSubdomainCheck = get(config, 'cdn.subdomain');

		if (!cdnSubdomainCheck || cdnSubdomainCheck.trim() === '') {
			if (usingEnv) {
				logger.error('s3 file storage is disabled and no CDN subdomain was set. Set the PN_ACT_CONFIG_CDN_SUBDOMAIN environment variable');
			} else {
				logger.error('s3 file storage is disabled and no CDN subdomain was set. Set cdn.subdomain in your config.json');
			}

			process.exit(0);
		}

		if (disabledFeatures.redis) {
			logger.warn('Both s3 and Redis are disabled. Large CDN files will use the in-memory cache, which may result in high memory use. Please enable s3 if you\'re running a production server.');
		}

		logger.warn(`s3 file storage disabled. Using disk-based file storage. Please ensure cdn.base_url config or PN_ACT_CONFIG_CDN_BASE env variable is set to point to this server with the subdomain being ${config.cdn.subdomain}`);
	}

	module.exports.config = config;
}

module.exports = {
	configure,
	config,
	disabledFeatures
};