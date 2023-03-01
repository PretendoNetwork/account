// handles serving assets 

const express = require('express');
const subdomain = require('express-subdomain');
const logger = require('../../logger');
const path = require('path');

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

module.exports = router;