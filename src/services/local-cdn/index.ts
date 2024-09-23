import express from 'express';
import { config, disabledFeatures } from '@/config-manager';
import { LOG_INFO, formatHostnames } from '@/logger';

import get from '@/services/local-cdn/routes/get';
import { restrictHostnames } from '@/middleware/host-limit';

const router = express.Router();

if (disabledFeatures.s3) {
	// * s3 disabled, setup local CDN

	// * Router to handle the subdomain
	const localcdn = express.Router();

	// * Setup routes
	LOG_INFO('[LOCAL-CDN] Applying imported routes');
	localcdn.use(get);

	// * Create domains
	LOG_INFO(`[LOCAL-CDN] Creating cdn router with domains: ${formatHostnames(config.domains.cdn)}`);
	router.use(restrictHostnames(config.domains.cdn, localcdn));
} else {
	LOG_INFO('[LOCAL-CDN] s3 enabled, skipping local CDN');
}

export default router;