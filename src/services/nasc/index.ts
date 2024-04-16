// * handles NASC endpoints

import express from 'express';
import subdomain from 'express-subdomain';
import NASCMiddleware from '@/middleware/nasc';
import { LOG_INFO } from '@/logger';

import ac from '@/services/nasc/routes/ac';

// * Router to handle the subdomain restriction
const nasc = express.Router();

LOG_INFO('[NASC] Importing middleware');
nasc.use(NASCMiddleware);

// * Setup routes
LOG_INFO('[NASC] Applying imported routes');
nasc.use('/ac', ac);

// * Main router for endpoints
const router = express.Router();

// * Create subdomains
LOG_INFO('[NASC] Creating \'nasc\' subdomain');
router.use(subdomain('nasc', nasc));

export default router;