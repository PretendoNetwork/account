// handles NASC endpoints

const express = require('express');
const subdomain = require('express-subdomain');
const logger = require('../../../logger');
const routes = require('./routes');

// Main router for endpoints
const router = express.Router();

// Router to handle the subdomain restriction
const nasc = express.Router();

// Create subdomains
logger.info('[ACCOUNT - 3DS] Creating \'nasc\' subdomain');
router.use(subdomain('nasc', nasc));

// Setup routes
logger.info('[ACCOUNT - 3DS] Applying imported routes');
nasc.use('/ac', routes.AC);

module.exports = router;