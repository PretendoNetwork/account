// handles CBVC (CTR Browser Version Check?) endpoints

import express from 'express';
import subdomain from 'express-subdomain';
import { LOG_INFO } from '@/logger';

// Router to handle the subdomain restriction
const cbvc = express.Router();

// Setup route
LOG_INFO('[cbvc] Applying imported routes');
cbvc.get('/:consoleType/:unknown/:region', (request: express.Request, response: express.Response): void => {
	response.set('Content-Type', 'text/plain');

	// * https://www.3dbrew.org/wiki/Internet_Browser#Forced_system-update
	// * The returned value is a number which the Internet Browser then compares
	// * with its own version number. If the version number isn't higher than the
	// * returned value, it will show a console update message.
	// *
	// * Return 0 and allow any browser to connect.
	response.send('0');
});

// Main router for endpoints
const router = express.Router();

// Create subdomains
LOG_INFO('[cbvc] Creating \'cbvc\' subdomain');
router.use(subdomain('cbvc.cdn', cbvc));

export default router;
