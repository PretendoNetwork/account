// handles "account.nintendo.net" endpoints

const express = require('express');
const subdomain = require('express-subdomain');
const cemuMiddleware = require('../../middleware/cemu');
const pnidMiddleware = require('../../middleware/pnid');
const logger = require('../../../logger');
const routes = require('./routes');

// Router to handle the subdomain restriction
const account = express.Router();

logger.info('[ACCOUNT] Importing middleware');
account.use(cemuMiddleware);
account.use(pnidMiddleware);

// Setup routes
logger.info('[ACCOUNT] Applying imported routes');
account.use('/v1/api/admin', routes.ADMIN);
account.use('/v1/api/content', routes.CONTENT);
account.use('/v1/api/devices', routes.DEVICES);
account.use('/v1/api/miis', routes.MIIS);
account.use('/v1/api/oauth20', routes.OAUTH);
account.use('/v1/api/people', routes.PEOPLE);
account.use('/v1/api/provider', routes.PROVIDER);
account.use('/v1/api/support', routes.SUPPORT);

// Main router for endpoints
const router = express.Router();

// Create subdomains
logger.info('[ACCOUNT] Creating \'account\' subdomain');
router.use(subdomain('account', account));

logger.info('[ACCOUNT] Creating \'c.account\' subdomain');
router.use(subdomain('c.account', account));

module.exports = router;