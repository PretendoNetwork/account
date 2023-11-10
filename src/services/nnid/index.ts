// handles "account.nintendo.net" endpoints

import path from 'node:path';
import express from 'express';
import subdomain from 'express-subdomain';

import clientHeaderCheck from '@/middleware/client-header';
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
import settings from '@/services/nnid/routes/settings';

// Router to handle the subdomain restriction
const nnid: express.Router = express.Router();
const middleware: express.Router = express.Router();

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

LOG_INFO('[NNID] Importing middleware');
middleware.use(clientHeaderCheck);
middleware.use(pnidMiddleware);

// Setup routes
LOG_INFO('[NNID] Applying imported routes');
nnid.use('/v1/account-settings/', settings);
nnid.use('/v1/account-settings/css/', setCSSHeader, express.static(path.join(__dirname, '../../assets/user-info-settings')));
nnid.use('/v1/account-settings/js/', setJSHeader, express.static(path.join(__dirname, '../../assets/user-info-settings')));
nnid.use('/v1/account-settings/img/', setIMGHeader, express.static(path.join(__dirname, '../../assets/user-info-settings')));

nnid.use('/v1/api/admin', middleware, admin);
nnid.use('/v1/api/content', middleware, content);
nnid.use('/v1/api/devices', middleware, devices);
nnid.use('/v1/api/miis', middleware, miis);
nnid.use('/v1/api/oauth20', middleware, oauth);
nnid.use('/v1/api/people', middleware, people);
nnid.use('/v1/api/provider', middleware, provider);
nnid.use('/v1/api/support', middleware, support);

// Main router for endpoints
const router = express.Router();

// Create subdomains
LOG_INFO('[NNID] Creating \'account\' subdomain');
router.use(subdomain('account', nnid));

LOG_INFO('[NNID] Creating \'c.account\' subdomain');
router.use(subdomain('c.account', nnid));

export default router;