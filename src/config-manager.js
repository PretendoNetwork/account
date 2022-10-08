const fs = require('fs-extra');
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

	module.exports.config = config;
}

module.exports = {
	configure,
	config
};