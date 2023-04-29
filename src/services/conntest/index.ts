// handles conntest endpoints

import express from 'express';
import subdomain from 'express-subdomain';
import { LOG_INFO } from '@/logger';

// Router to handle the subdomain restriction
const conntest: express.Router = express.Router();

// Setup route
LOG_INFO('[conntest] Applying imported routes');
conntest.get('/', (request: express.Request, response: express.Response): void => {
	response.set('Content-Type', 'text/html');
	response.set('X-Organization', 'Nintendo');

	response.send(`
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
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

// Main router for endpoints
const router: express.Router = express.Router();

// Create subdomains
LOG_INFO('[conntest] Creating \'conntest\' subdomain');
router.use(subdomain('conntest', conntest));

export default router;