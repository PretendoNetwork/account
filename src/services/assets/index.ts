// * handles serving assets 

import path from 'node:path';
import express from 'express';
import subdomain from 'express-subdomain';
import { LOG_INFO } from '@/logger';

// * Router to handle the subdomain restriction
const assets = express.Router();

// * Setup public folder
LOG_INFO('[assets] Setting up public folder');
assets.use(express.static(path.join(__dirname, '../../assets')));

// * Main router for endpoints
const router = express.Router();

// * Create subdomains
LOG_INFO('[conntest] Creating \'assets\' subdomain');
router.use(subdomain('assets', assets));

export default router;