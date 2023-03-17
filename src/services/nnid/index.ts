// handles "account.nintendo.net" endpoints

import express from 'express';
import subdomain from 'express-subdomain';
import clientHeaderCheck from '@/middleware/client-header';
import cemuMiddleware from '@/middleware/cemu';
import pnidMiddleware from '@/middleware/pnid';
import { LOG_INFO } from '@/logger';

import admin from '@/services/nnid/routes/admin';
import content from '@/services/nnid/routes/content';
import devices from '@/services/nnid/routes/devices';
import miis from '@/services/nnid/routes/miis';
import oauth from '@/services/nnid/routes/oauth';
import people from '@/services/nnid/routes/people';
import provider from '@/services/nnid/routes/provider';
import support from '@/services/nnid/routes/support';

// Router to handle the subdomain restriction
const nnid = express.Router();

LOG_INFO('[NNID] Importing middleware');
nnid.use(clientHeaderCheck);
nnid.use(cemuMiddleware);
nnid.use(pnidMiddleware);

// Setup routes
LOG_INFO('[NNID] Applying imported routes');
nnid.use('/v1/api/admin', admin);
nnid.use('/v1/api/content', content);
nnid.use('/v1/api/devices', devices);
nnid.use('/v1/api/miis', miis);
nnid.use('/v1/api/oauth20', oauth);
nnid.use('/v1/api/people', people);
nnid.use('/v1/api/provider', provider);
nnid.use('/v1/api/support', support);

// Main router for endpoints
const router = express.Router();

// Create subdomains
LOG_INFO('[NNID] Creating \'account\' subdomain');
router.use(subdomain('account', nnid));

LOG_INFO('[NNID] Creating \'c.account\' subdomain');
router.use(subdomain('c.account', nnid));

export default router;