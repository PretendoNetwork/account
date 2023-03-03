// handles serving assets 

import path from 'node:path';
import express from 'express';
import subdomain from 'express-subdomain';
import logger from '../../logger';

// Router to handle the subdomain restriction
const assets = express.Router();

// Setup public folder
logger.info('[assets] Setting up public folder');
assets.use(express.static(path.join(__dirname, '../../assets')));

// Main router for endpoints
const router = express.Router();

// Create subdomains
logger.info('[conntest] Creating \'assets\' subdomain');
router.use(subdomain('assets', assets));

export default router;