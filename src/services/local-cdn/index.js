const express = require('express');
const subdomain = require('express-subdomain');
const logger = require('../../../logger');
const { config, disabledFeatures } = require('../../config-manager');

if (!disabledFeatures.s3) {
	// * s3 enabled, no need for this

	module.exports = express.Router();

	return;
}

const routes = require('./routes');

// Router to handle the subdomain
const localcdn = express.Router();

// Setup routes
logger.info('[LOCAL-CDN] Applying imported routes');
localcdn.use(routes.GET);

// Main router for endpoints
const router = express.Router();

// Create subdomains
logger.info(`[LOCAL-CDN] Creating '${config.cdn.subdomain}' subdomain`);
router.use(subdomain(config.cdn.subdomain, localcdn));

module.exports = router;