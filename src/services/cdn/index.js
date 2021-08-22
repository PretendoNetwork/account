const express = require('express');
const subdomain = require('express-subdomain');
const logger = require('../../../logger');
const routes = require('./routes');

// Router to handle the subdomain
const miiImagesCDN = express.Router();

// Setup routes
logger.info('[CDN] Applying imported routes');
miiImagesCDN.use(routes.MII_IMAGES);

// Main router for endpoints
const router = express.Router();

// Create subdomains
logger.info('[CDN] Creating \'mii-images.cdn\' subdomain');
router.use(subdomain('mii-images.cdn', miiImagesCDN));

module.exports = router;