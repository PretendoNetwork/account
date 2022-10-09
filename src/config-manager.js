const fs = require('fs-extra');
const get = require('lodash.get');
const set = require('lodash.set');
const logger = require('../logger');

require('dotenv').config();

/**
 * @typedef {Object} Config
 * @property {object} http HTTP server settings
 * @property {number} http.port HTTP port the server will listen on
 * @property {object} mongoose Mongose connection settings
 * @property {string} mongoose.uri URI Mongoose will connect to
 * @property {string} mongoose.database MongoDB database name
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
 * @property {object} [aws] s3 client settings
 * @property {object} [aws.spaces] Digital Ocean Spaces settings
 * @property {string} [aws.spaces.key] s3 access key
 * @property {string} [aws.spaces.secret] s3 access secret
 * @property {object} [hcaptcha] hCaptcha settings
 * @property {string} [hcaptcha.secret] hCaptcha secret
 * @property {string} [cdn_subdomain] Subdomain used for serving CDN contents when s3 is disabled
 * @property {string} cdn_base Base URL for CDN location
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
	['mongoose.uri', 'PN_ACT_CONFIG_MONGO_URI'],
	['mongoose.database', 'PN_ACT_CONFIG_MONGO_DB_NAME'],
	['cdn_base', 'PN_ACT_CONFIG_CDN_BASE'],
	['website_base', 'PN_ACT_CONFIG_WEBSITE_BASE'],
];

function configure() {
	if (process.env.PN_ACT_PREFER_ENV_CONFIG === 'true') {
		logger.info('Loading config from env');

		config = {
			http: {
				port: Number(process.env.PN_ACT_CONFIG_HTTP_PORT)
			},
			mongoose: {
				uri: process.env.PN_ACT_CONFIG_MONGO_URI,
				database: process.env.PN_ACT_CONFIG_MONGO_DB_NAME,
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
			aws: {
				spaces: {
					key: process.env.PN_ACT_CONFIG_S3_ACCESS_KEY,
					secret: process.env.PN_ACT_CONFIG_S3_ACCESS_SECRET
				}
			},
			hcaptcha: {
				secret: process.env.PN_ACT_CONFIG_HCAPTCHA_SECRET
			},
			cdn_base: process.env.PN_ACT_CONFIG_CDN_BASE,
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

	const redisConfigValue = get(config, 'redis.client.url');
	const redisEnvValue = get(process.env, 'PN_ACT_CONFIG_REDIS_URL');

	if (!redisConfigValue || redisConfigValue.trim() === '') {
		if (!redisEnvValue || redisEnvValue.trim() === '') {
			logger.warn('Failed to find Redis config. Disabling feature and using in-memory cache');

			disabledFeatures.redis = true;
		} else {
			logger.info('redis.client.url not found in config, using environment variable PN_ACT_CONFIG_REDIS_URL');

			set(config, 'redis.client.url', redisEnvValue);
		}
	}

	const emailHostConfigValue = get(config, 'email.host');
	const emailHostEnvValue = get(process.env, 'PN_ACT_CONFIG_EMAIL_HOST');

	if (!emailHostConfigValue || emailHostConfigValue.trim() === '') {
		if (!emailHostEnvValue || emailHostEnvValue.trim() === '') {
			logger.warn('Failed to find email SMTP host config. Disabling feature');

			disabledFeatures.email = true;
		} else {
			logger.info('email.host not found in config, using environment variable PN_ACT_CONFIG_EMAIL_HOST');

			set(config, 'email.host', emailHostEnvValue);
		}
	}

	const emailPortConfigValue = get(config, 'email.port');
	const emailPortEnvValue = get(process.env, 'PN_ACT_CONFIG_EMAIL_PORT');

	if (!emailPortConfigValue) {
		if (!emailPortEnvValue || emailPortEnvValue.trim() === '') {
			logger.warn('Failed to find email SMTP port config. Disabling feature');

			disabledFeatures.email = true;
		} else {
			logger.info('email.port not found in config, using environment variable PN_ACT_CONFIG_EMAIL_PORT');

			set(config, 'email.port', Number(emailPortEnvValue));
		}
	}

	const emailSecureConfigValue = get(config, 'email.secure');
	const emailSecureEnvValue = get(process.env, 'PN_ACT_CONFIG_EMAIL_SECURE');

	if (emailSecureConfigValue === undefined) {
		if (!emailSecureEnvValue || emailSecureEnvValue.trim() === '') {
			logger.warn('Failed to find email SMTP secure config. Disabling feature');

			disabledFeatures.email = true;
		} else {
			logger.info('email.secure not found in config, using environment variable PN_ACT_CONFIG_EMAIL_SECURE');

			set(config, 'email.secure', Boolean(emailSecureEnvValue));
		}
	}

	const emailUsernameConfigValue = get(config, 'email.auth.user');
	const emailUsernameEnvValue = get(process.env, 'PN_ACT_CONFIG_EMAIL_USERNAME');

	if (!emailUsernameConfigValue || emailUsernameConfigValue.trim() === '') {
		if (!emailUsernameEnvValue || emailUsernameEnvValue.trim() === '') {
			logger.warn('Failed to find email username config. Disabling feature');

			disabledFeatures.email = true;
		} else {
			logger.info('email.auth.user not found in config, using environment variable PN_ACT_CONFIG_EMAIL_USERNAME');

			set(config, 'email.auth.user', emailUsernameEnvValue);
		}
	}

	const emailPasswordConfigValue = get(config, 'email.auth.pass');
	const emailPasswordEnvValue = get(process.env, 'PN_ACT_CONFIG_EMAIL_PASSWORD');

	if (!emailPasswordConfigValue || emailPasswordConfigValue.trim() === '') {
		if (!emailPasswordEnvValue || emailPasswordEnvValue.trim() === '') {
			logger.warn('Failed to find email password config. Disabling feature');

			disabledFeatures.email = true;
		} else {
			logger.info('email.pass not found in config, using environment variable PN_ACT_CONFIG_EMAIL_PASSWORD');

			set(config, 'email.pass', emailPasswordEnvValue);
		}
	}

	const emailFromConfigValue = get(config, 'email.from');
	const emailFromEnvValue = get(process.env, 'PN_ACT_CONFIG_EMAIL_FROM');

	if (!emailFromConfigValue || emailFromConfigValue.trim() === '') {
		if (!emailFromEnvValue || emailFromEnvValue.trim() === '') {
			logger.warn('Failed to find email from config. Disabling feature');

			disabledFeatures.email = true;
		} else {
			logger.info('email.from not found in config, using environment variable PN_ACT_CONFIG_EMAIL_FROM');

			set(config, 'email.from', emailFromEnvValue);
		}
	}

	const captchaSecretConfigValue = get(config, 'hcaptcha.secret');
	const captchaSecretEnvValue = get(process.env, 'PN_ACT_CONFIG_HCAPTCHA_SECRET');

	if (!captchaSecretConfigValue || captchaSecretConfigValue.trim() === '') {
		if (!captchaSecretEnvValue || captchaSecretEnvValue.trim() === '') {
			logger.warn('Failed to find captcha secret config. Disabling feature');

			disabledFeatures.email = true;
		} else {
			logger.info('hcaptcha.secret not found in config, using environment variable PN_ACT_CONFIG_HCAPTCHA_SECRET');

			set(config, 'hcaptcha.secret', emailFromEnvValue);
		}
	}

	const s3AccessKeyConfigValue = get(config, 'aws.spaces.key');
	const s3AccessKeyEnvValue = get(process.env, 'PN_ACT_CONFIG_S3_ACCESS_KEY');

	if (!s3AccessKeyConfigValue || s3AccessKeyConfigValue.trim() === '') {
		if (!s3AccessKeyEnvValue || s3AccessKeyEnvValue.trim() === '') {
			logger.warn('Failed to find s3 access key config. Disabling feature');

			disabledFeatures.s3 = true;
		} else {
			logger.info('aws.spaces.key not found in config, using environment variable PN_ACT_CONFIG_S3_ACCESS_KEY');

			set(config, 'aws.spaces.key', s3AccessKeyEnvValue);
		}
	}

	const s3SecretKeyConfigValue = get(config, 'aws.spaces.secret');
	const s3SecretKeyEnvValue = get(process.env, 'PN_ACT_CONFIG_S3_ACCESS_SECRET');

	if (!s3SecretKeyConfigValue || s3SecretKeyConfigValue.trim() === '') {
		if (!s3SecretKeyEnvValue || s3SecretKeyEnvValue.trim() === '') {
			logger.warn('Failed to find s3 secret key config. Disabling feature');

			disabledFeatures.s3 = true;
		} else {
			logger.info('aws.spaces.secret not found in config, using environment variable PN_ACT_CONFIG_S3_ACCESS_SECRET');

			set(config, 'aws.spaces.secret', s3AccessKeyEnvValue);
		}
	}

	if (disabledFeatures.s3) {
		const cdnSubdomainConfigValue = get(config, 'cdn_subdomain');
		const cdnSubdomainEnvValue = get(process.env, 'PN_ACT_CONFIG_CDN_SUBDOMAIN');

		if (!cdnSubdomainConfigValue || cdnSubdomainConfigValue.trim() === '') {
			if (!cdnSubdomainEnvValue || cdnSubdomainEnvValue.trim() === '') {
				logger.error('s3 file storage is disabled and no CDN subdomain was set. Set cdn_subdomain in config.json or the PN_ACT_CONFIG_CDN_SUBDOMAIN environment variable');
				process.exit(0);
			} else {
				logger.info('cdn_subdomain not found in config, using environment variable PN_ACT_CONFIG_CDN_SUBDOMAIN');

				set(config, 'cdn_subdomain', cdnSubdomainEnvValue);
			}
		}

		logger.warn(`s3 file storage disabled. Using disk-based file storage. Please ensure cdn_base config or PN_ACT_CONFIG_CDN_BASE env variable is set to point to this server with the subdomain being ${config.cdn_subdomain}`);
	}

	module.exports.config = config;
}

module.exports = {
	configure,
	config,
	disabledFeatures
};