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
 * @property {object} redis redis settings
 * @property {string} redis.client redis client settings
 * @property {string} redis.client.url redis server URL
 * @property {object} email node-mailer client settings
 * @property {string} email.host SMTP server address
 * @property {number} email.port SMTP server port
 * @property {boolean} email.secure Secure SMTP
 * @property {string} email.from Email 'from' name/address
 * @property {object} email.auth Email authentication settings
 * @property {string} email.auth.user Email username
 * @property {string} email.auth.pass Email password
 * @property {object} aws s3 client settings
 * @property {object} aws.spaces Digital Ocean Spaces settings
 * @property {string} aws.spaces.key s3 access key
 * @property {string} aws.spaces.secret s3 access secret
 * @property {object} hcaptcha hCaptcha settings
 * @property {string} hcaptcha.secret hCaptcha secret
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
 */

/**
 * @type {DisabledFeatures}
 */
const disabledFeatures = {
	redis: false,
	email: false
};

const requiredFields = [
	['http.port', 'PN_ACT_CONFIG_HTTP_PORT', Number],
	['mongoose.uri', 'PN_ACT_CONFIG_MONGO_URI'],
	['mongoose.database', 'PN_ACT_CONFIG_MONGO_DB_NAME'],
	['aws.spaces.key', 'PN_ACT_CONFIG_S3_ACCESS_KEY'],
	['aws.spaces.secret', 'PN_ACT_CONFIG_S3_ACCESS_SECRET'],
	['hcaptcha.secret', 'PN_ACT_CONFIG_HCAPTCHA_SECRET'],
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

		if (!configValue || configValue.trim() === '') {
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
	const redisEnvValue = get(process.env, 'redis.client.url');

	if (!redisConfigValue || redisConfigValue.trim() === '') {
		if (!redisEnvValue || redisEnvValue.trim() === '') {
			logger.warning('Failed to find Redis config. Disabling feature and using in-memory cache');

			disabledFeatures.redis = true;
		}
	}

	const emailHostConfigValue = get(config, 'email.host');
	const emailHostEnvValue = get(process.env, 'PN_ACT_CONFIG_EMAIL_HOST');

	if (!emailHostConfigValue || emailHostConfigValue.trim() === '') {
		if (!emailHostEnvValue || emailHostEnvValue.trim() === '') {
			logger.warning('Failed to find email SMTP host config. Disabling feature');

			disabledFeatures.email = true;
		}
	}

	const emailPortConfigValue = get(config, 'email.port');
	const emailPortEnvValue = get(process.env, 'PN_ACT_CONFIG_EMAIL_PORT');

	if (!emailPortConfigValue) {
		if (!emailPortEnvValue || emailPortEnvValue.trim() === '') {
			logger.warning('Failed to find email SMTP port config. Disabling feature');

			disabledFeatures.email = true;
		}
	}

	const emailSecureConfigValue = get(config, 'email.secure');
	const emailSecureEnvValue = get(process.env, 'PN_ACT_CONFIG_EMAIL_SECURE');

	if (emailSecureConfigValue === undefined) {
		if (!emailSecureEnvValue || emailSecureEnvValue.trim() === '') {
			logger.warning('Failed to find email SMTP secure config. Disabling feature');

			disabledFeatures.email = true;
		}
	}

	const emailUsernameConfigValue = get(config, 'email.auth.user');
	const emailUsernameEnvValue = get(process.env, 'PN_ACT_CONFIG_EMAIL_USERNAME');

	if (!emailUsernameConfigValue || emailUsernameConfigValue.trim() === '') {
		if (!emailUsernameEnvValue || emailUsernameEnvValue.trim() === '') {
			logger.warning('Failed to find email username config. Disabling feature');

			disabledFeatures.email = true;
		}
	}

	const emailPasswordConfigValue = get(config, 'email.auth.pass');
	const emailPasswordEnvValue = get(process.env, 'PN_ACT_CONFIG_EMAIL_PASSWORD');

	if (!emailPasswordConfigValue || emailPasswordConfigValue.trim() === '') {
		if (!emailPasswordEnvValue || emailPasswordEnvValue.trim() === '') {
			logger.warning('Failed to find email password config. Disabling feature');

			disabledFeatures.email = true;
		}
	}

	const emailFromConfigValue = get(config, 'email.from');
	const emailFromEnvValue = get(process.env, 'PN_ACT_CONFIG_EMAIL_FROM');

	if (!emailFromConfigValue || emailFromConfigValue.trim() === '') {
		if (!emailFromEnvValue || emailFromEnvValue.trim() === '') {
			logger.warning('Failed to find email from config. Disabling feature');

			disabledFeatures.email = true;
		}
	}

	module.exports.config = config;
}

module.exports = {
	configure,
	config
};