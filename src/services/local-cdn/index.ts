import express from 'express';
import subdomain from 'express-subdomain';
import { config, disabledFeatures } from '@/config-manager';
import { LOG_INFO } from '@/logger';

import get from '@/services/local-cdn/routes/get';

const router = express.Router();

if (disabledFeatures.s3) {
	// * s3 disabled, setup local CDN

	// * Router to handle the subdomain
	const localcdn = express.Router();

	// * Setup routes
	LOG_INFO('[LOCAL-CDN] Applying imported routes');
	localcdn.use(get);

	// * Create subdomains
	LOG_INFO(`[LOCAL-CDN] Creating '${config.cdn.subdomain}' subdomain`);
	router.use(subdomain(config.cdn.subdomain, localcdn));
} else {
	LOG_INFO('[LOCAL-CDN] s3 enabled, skipping local CDN');
}

export default router;