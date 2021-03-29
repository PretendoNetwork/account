// handles "account.nintendo.net" endpoints

const express = require('express');
const subdomain = require('express-subdomain');
const sessionMiddleware = require('../../middleware/session');
const pnidMiddleware = require('../../middleware/pnid');
const logger = require('../../../logger');
const routes = require('./routes');

// Router to handle the subdomain restriction
const account = express.Router();

logger.info('[ACCOUNT - WiiU] Importing middleware');
account.use(sessionMiddleware);
account.use(pnidMiddleware);

// Setup routes
logger.info('[ACCOUNT - WiiU] Applying imported routes');
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
logger.info('[ACCOUNT - WiiU] Creating \'account\' subdomain');
router.use(subdomain('account', account));

module.exports = router;