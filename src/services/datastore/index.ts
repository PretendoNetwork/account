import express from 'express';
import subdomain from 'express-subdomain';
import { LOG_INFO } from '@/logger';

import upload from '@/services/datastore/routes/upload';

// Router to handle the subdomain
const datastore: express.Router = express.Router();

// Setup routes
LOG_INFO('[DATASTORE] Applying imported routes');
datastore.use(upload);

// Main router for endpoints
const router: express.Router = express.Router();

// Create subdomains
LOG_INFO('[DATASTORE] Creating \'datastore\' subdomain');
router.use(subdomain('datastore', datastore));

export default router;