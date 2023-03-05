// handles "api.nintendo.cc" endpoints

import express from 'express';
import subdomain from 'express-subdomain';
import cors from 'cors';
import APIMiddleware from '@/middleware/api';
import routes from '@/services/api/routes';
import logger from '@/logger';

// Router to handle the subdomain restriction
const api = express.Router();

logger.info('[USER API] Importing middleware');
api.use(APIMiddleware);
api.use(cors());
api.options('*', cors());

// Setup routes
logger.info('[USER API] Applying imported routes');
api.use('/v1/connections', routes.V1.CONNECTIONS);
api.use('/v1/email', routes.V1.EMAIL);
api.use('/v1/forgot-password', routes.V1.FORGOT_PASSWORD);
api.use('/v1/login', routes.V1.LOGIN);
api.use('/v1/register', routes.V1.REGISTER);
api.use('/v1/reset-password', routes.V1.RESET_PASSWORD);
api.use('/v1/user', routes.V1.USER);


// Main router for endpoints
const router = express.Router();

// Create subdomains
logger.info('[USER API] Creating \'api\' subdomain');
router.use(subdomain('api', api));

export default router;