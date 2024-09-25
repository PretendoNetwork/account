// * handles CBVC (CTR Browser Version Check?) endpoints

import express from 'express';
import { LOG_INFO, formatHostnames } from '@/logger';
import { config } from '@/config-manager';
import { restrictHostnames } from '@/middleware/host-limit';

// * Router to handle the subdomain restriction
const cbvc = express.Router();

// * Setup route
LOG_INFO('[CBVC] Applying imported routes');
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

// * Main router for endpoints
const router = express.Router();

// * Create domains
LOG_INFO(`[CBVC] Creating cbvc router with domains: ${formatHostnames(config.domains.cbvc)}`);
router.use(restrictHostnames(config.domains.cbvc, cbvc));

export default router;
