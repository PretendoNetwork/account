import express from 'express';
import cors from 'cors';
import APIMiddleware from '@/middleware/api';
import { formatHostnames, LOG_INFO } from '@/logger';

import { V1 } from '@/services/api/routes';
import { config } from '@/config-manager';
import { restrictHostnames } from '@/middleware/host-limit';

// * Router to handle the subdomain restriction
const api = express.Router();

LOG_INFO('[USER API] Importing middleware');
api.use(APIMiddleware);
api.use(cors());
api.options('*', cors());

// * Setup routes
LOG_INFO('[USER API] Applying imported routes');
api.use('/v1/connections', V1.CONNECTIONS);
api.use('/v1/email', V1.EMAIL);
api.use('/v1/forgot-password', V1.FORGOT_PASSWORD);
api.use('/v1/login', V1.LOGIN);
api.use('/v1/register', V1.REGISTER);
api.use('/v1/reset-password', V1.RESET_PASSWORD);
api.use('/v1/user', V1.USER);


// * Main router for endpoints
const router = express.Router();

// * Create domains
LOG_INFO(`[USER API] Registering api router with domains: ${formatHostnames(config.domains.api)}`);
router.use(restrictHostnames(config.domains.api, api));

export default router;