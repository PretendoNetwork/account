// * handles serving assets

import path from 'node:path';
import express from 'express';
import { LOG_INFO, formatHostnames } from '@/logger';
import { config } from '@/config-manager';
import { restrictHostnames } from '@/middleware/host-limit';

// * Router to handle the subdomain restriction
const assets = express.Router();

// * Setup public folder
LOG_INFO('[assets] Setting up public folder');
assets.use(express.static(path.join(__dirname, '../../assets')));

// * Main router for endpoints
const router = express.Router();

// * Create domains
LOG_INFO(`[assets] Creating assets router with domains: ${formatHostnames(config.domains.assets)}`);
router.use(restrictHostnames(config.domains.assets, assets));

export default router;
