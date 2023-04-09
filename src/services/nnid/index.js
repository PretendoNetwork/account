const express = require('express');
const subdomain = require('express-subdomain');
const logger = require('../../../logger');
const clientHeaderCheck = require('../../middleware/client-header');
const cemuMiddleware = require('../../middleware/cemu');
const pnidMiddleware = require('../../middleware/pnid');
const routes = require('./routes');

const nnid = express.Router();

// Add middleware to nnid router
nnid.use(clientHeaderCheck);
nnid.use(cemuMiddleware);
nnid.use(pnidMiddleware);

// Register routes on nnid router
nnid.use('/v1/api/admin', routes.ADMIN);
nnid.use('/v1/api/content', routes.CONTENT);
nnid.use('/v1/api/devices', routes.DEVICES);
nnid.use('/v1/api/miis', routes.MIIS);
nnid.use('/v1/api/oauth20', routes.OAUTH);
nnid.use('/v1/api/people', routes.PEOPLE);
nnid.use('/v1/api/provider', routes.PROVIDER);
nnid.use('/v1/api/support', routes.SUPPORT);

const router = express.Router();

// Register nnid router as a subdomain for 'account' and 'c.account' domains
router.use(subdomain('account', nnid));
router.use(subdomain('c.account', nnid));

logger.info('[NNID] Successfully set up the \'account\' and \'c.account\' subdomains.');

module.exports = router;
