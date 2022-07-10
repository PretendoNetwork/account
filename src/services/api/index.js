// handles "api.nintendo.cc" endpoints

const express = require('express');
const subdomain = require('express-subdomain');
const cors = require('cors');
const APIMiddleware = require('../../middleware/api');
const logger = require('../../../logger');
const routes = require('./routes');

// Router to handle the subdomain restriction
const api = express.Router();

logger.info('[USER API] Importing middleware');
api.use(APIMiddleware);
api.use(cors());
api.options('*', cors());

// Setup routes
logger.info('[USER API] Applying imported routes');
api.use('/v1/register', routes.V1.REGISTER);
api.use('/v1/login', routes.V1.LOGIN);
api.use('/v1/user', routes.V1.USER);
api.use('/v1/connections', routes.V1.CONNECTIONS);

// Main router for endpoints
const router = express.Router();

// Create subdomains
logger.info('[USER API] Creating \'api\' subdomain');
router.use(subdomain('api', api));

module.exports = router;