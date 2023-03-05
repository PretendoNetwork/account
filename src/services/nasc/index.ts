// handles NASC endpoints

import express from 'express';
import subdomain from 'express-subdomain';
import NASCMiddleware from '@/middleware/nasc';
import routes from '@/services/nasc/routes';
import logger from '@/logger';

// Router to handle the subdomain restriction
const nasc = express.Router();

logger.info('[NASC] Importing middleware');
nasc.use(NASCMiddleware);

// Setup routes
logger.info('[NASC] Applying imported routes');
nasc.use('/ac', routes.AC);

// Main router for endpoints
const router = express.Router();

// Create subdomains
logger.info('[NASC] Creating \'nasc\' subdomain');
router.use(subdomain('nasc', nasc));

export default router;