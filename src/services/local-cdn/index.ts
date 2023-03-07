import express from 'express';
import subdomain from 'express-subdomain';
import routes from '@/services/local-cdn/routes';
import { config, disabledFeatures } from '@/config-manager';
import logger from '@/logger';

const router: express.Router = express.Router();

if (disabledFeatures.s3) {
	// * s3 disabled, setup local CDN

	// * Router to handle the subdomain
	const localcdn: express.Router = express.Router();

	// * Setup routes
	logger.info('[LOCAL-CDN] Applying imported routes');
	localcdn.use(routes.GET);

	// * Create subdomains
	logger.info(`[LOCAL-CDN] Creating '${config.cdn.subdomain}' subdomain`);
	router.use(subdomain(config.cdn.subdomain, localcdn));
} else {
	logger.info('[LOCAL-CDN] s3 enabled, skipping local CDN');
}

export default router;