// * handles "account.nintendo.net" endpoints

import path from 'node:path';
import express from 'express';
import subdomain from 'express-subdomain';
import clientHeaderCheck from '@/middleware/client-header';
import cemuMiddleware from '@/middleware/cemu';
import pnidMiddleware from '@/middleware/pnid';
import { LOG_INFO } from '@/logger';

import admin from '@/services/nnas/routes/admin';
import content from '@/services/nnas/routes/content';
import devices from '@/services/nnas/routes/devices';
import miis from '@/services/nnas/routes/miis';
import oauth from '@/services/nnas/routes/oauth';
import people from '@/services/nnas/routes/people';
import provider from '@/services/nnas/routes/provider';
import support from '@/services/nnas/routes/support';
import settings from '@/services/nnas/routes/account-settings';

// * Router to handle the subdomain restriction
const nnas = express.Router();

// Static routes for the user information app
async function setCSSHeader(request: express.Request, response: express.Response, next: express.NextFunction): Promise<void> {
	response.set('Content-Type', 'text/css');
	return next();
}

async function setJSHeader(request: express.Request, response: express.Response, next: express.NextFunction): Promise<void> {
	response.set('Content-Type', 'text/javascript');
	return next();
}

async function setIMGHeader(request: express.Request, response: express.Response, next: express.NextFunction): Promise<void> {
	response.set('Content-Type', 'image/png');
	return next();
}

// * Setup routes
LOG_INFO('[NNAS] Applying imported routes');
nnas.use('/v1/account-settings/', settings);
nnas.use('/v1/account-settings/css/', setCSSHeader, express.static(path.join(__dirname, '../../assets/user-info-settings')));
nnas.use('/v1/account-settings/js/', setJSHeader, express.static(path.join(__dirname, '../../assets/user-info-settings')));
nnas.use('/v1/account-settings/img/', setIMGHeader, express.static(path.join(__dirname, '../../assets/user-info-settings')));

LOG_INFO('[NNAS] Importing middleware');
nnas.use(clientHeaderCheck);
nnas.use(cemuMiddleware);
nnas.use(pnidMiddleware);

nnas.use('/v1/api/admin', admin);
nnas.use('/v1/api/content', content);
nnas.use('/v1/api/devices', devices);
nnas.use('/v1/api/miis', miis);
nnas.use('/v1/api/oauth20', oauth);
nnas.use('/v1/api/people', people);
nnas.use('/v1/api/provider', provider);
nnas.use('/v1/api/support', support);

// * Main router for endpoints
const router = express.Router();

// * Create subdomains
LOG_INFO('[NNAS] Creating \'account\' subdomain');
router.use(subdomain('account', nnas));

LOG_INFO('[NNAS] Creating \'c.account\' subdomain');
router.use(subdomain('c.account', nnas));

export default router;