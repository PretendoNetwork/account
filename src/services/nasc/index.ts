// * handles NASC endpoints

import express from 'express';
import NASCMiddleware from '@/middleware/nasc';
import { LOG_INFO, formatHostnames } from '@/logger';

import ac from '@/services/nasc/routes/ac';
import { restrictHostnames } from '@/middleware/host-limit';
import { config } from '@/config-manager';

// * Router to handle the subdomain restriction
const nasc = express.Router();

LOG_INFO('[NASC] Importing middleware');
nasc.use(NASCMiddleware);

// * Setup routes
LOG_INFO('[NASC] Applying imported routes');
nasc.use('/ac', ac);

// * Main router for endpoints
const router = express.Router();

// * Create domains
LOG_INFO(`[NASC] Creating nasc router with domains: ${formatHostnames(config.domains.nasc)}`);
router.use(restrictHostnames(config.domains.nasc, nasc));

export default router;