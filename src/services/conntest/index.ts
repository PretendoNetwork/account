// * handles conntest endpoints

import express from 'express';
import { LOG_INFO, formatHostnames } from '@/logger';
import { restrictHostnames } from '@/middleware/host-limit';
import { config } from '@/config-manager';

// * Router to handle the subdomain restriction
const conntest = express.Router();

// * Setup route
LOG_INFO('[conntest] Applying imported routes');
conntest.get('/', (request: express.Request, response: express.Response): void => {
	response.set('Content-Type', 'text/html');
	response.set('X-Organization', 'Nintendo');

	response.send(`
<!DOCTYPE html PUBLIC "-// *W3C// *DTD XHTML 1.0 Transitional// *EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html>
<head>
<title>HTML Page</title>
</head>
<body bgcolor="#FFFFFF">
This is test.html page
</body>
</html>
`);
});

// * Main router for endpoints
const router = express.Router();

// * Create domains
LOG_INFO(`[conntest] Creating conntest router with domains: ${formatHostnames(config.domains.conntest)}`);
router.use(restrictHostnames(config.domains.conntest, conntest));

export default router;
