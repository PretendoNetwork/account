const express = require('express');
const subdomain = require('express-subdomain');
const logger = require('../../../logger');
const routes = require('./routes');

// Router to handle the subdomain
const datastore = express.Router();

// Setup routes
logger.info('[DATASTORE] Applying imported routes');
datastore.use(routes.UPLOAD);

// Main router for endpoints
const router = express.Router();

// Create subdomains
logger.info('[DATASTORE] Creating \'datastore\' subdomain');
router.use(subdomain('datastore', datastore));

module.exports = router;