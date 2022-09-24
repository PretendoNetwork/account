// handles NASC endpoints

const express = require('express');
const subdomain = require('express-subdomain');
const NASCMiddleware = require('../../middleware/nasc');
const logger = require('../../../logger');
const routes = require('./routes');

// Router to handle the subdomain restriction
const nasc = express.Router();

logger.info('[NASC] Importing middleware');
nasc.use(NASCMiddleware);

// Setup routes
logger.info('[NASC] Applying imported routes');
nasc.use('/ac', routes.AC);

// Main router for endpoints
const router = express.Router();

// Create subdomains
logger.info('[NASC] Creating \'nasc\' subdomain');
router.use(subdomain('nasc', nasc));

module.exports = router;