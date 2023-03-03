import express from 'express';
import subdomain from 'express-subdomain';
import routes from './routes';
import logger from '../../logger';

// Router to handle the subdomain
const datastore = express.Router();

// Setup routes
logger.info('[DATASTORE] Applying imported routes');
datastore.use(routes.UPLOAD);

// Main router for endpoints
const router = express.Router();

// Create subdomains
logger.info('[DATASTORE] Creating \'datastore\' subdomain');
router.use(subdomain('datastore', datastore));

export default router;