import express from 'express';
import { LOG_INFO, formatHostnames } from '@/logger';

import upload from '@/services/datastore/routes/upload';
import { restrictHostnames } from '@/middleware/host-limit';
import { config } from '@/config-manager';

// * Router to handle the subdomain
const datastore = express.Router();

// * Setup routes
LOG_INFO('[DATASTORE] Applying imported routes');
datastore.use(upload);

// * Main router for endpoints
const router = express.Router();

// * Create domains
LOG_INFO(`[DATASTORE] Creating datastore router with domains: ${formatHostnames(config.domains.datastore)}`);
router.use(restrictHostnames(config.domains.datastore, datastore));

export default router;