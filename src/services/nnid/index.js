// handles "account.nintendo.net" endpoints

const express = require('express');
const subdomain = require('express-subdomain');
const clientHeaderCheck = require('../../middleware/client-header');
const cemuMiddleware = require('../../middleware/cemu');
const pnidMiddleware = require('../../middleware/pnid');
const logger = require('../../logger');
const routes = require('./routes');

// Router to handle the subdomain restriction
const nnid = express.Router();

logger.info('[NNID] Importing middleware');
nnid.use(clientHeaderCheck);
nnid.use(cemuMiddleware);
nnid.use(pnidMiddleware);

// Setup routes
logger.info('[NNID] Applying imported routes');
nnid.use('/v1/api/admin', routes.ADMIN);
nnid.use('/v1/api/content', routes.CONTENT);
nnid.use('/v1/api/devices', routes.DEVICES);
nnid.use('/v1/api/miis', routes.MIIS);
nnid.use('/v1/api/oauth20', routes.OAUTH);
nnid.use('/v1/api/people', routes.PEOPLE);
nnid.use('/v1/api/provider', routes.PROVIDER);
nnid.use('/v1/api/support', routes.SUPPORT);

// Main router for endpoints
const router = express.Router();

// Create subdomains
logger.info('[NNID] Creating \'account\' subdomain');
router.use(subdomain('account', nnid));

logger.info('[NNID] Creating \'c.account\' subdomain');
router.use(subdomain('c.account', nnid));

module.exports = router;