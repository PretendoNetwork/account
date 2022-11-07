process.title = 'Pretendo - Account';

const configManager = require('./config-manager');

configManager.configure();

const express = require('express');
const morgan = require('morgan');
const xmlparser = require('./middleware/xml-parser');
const cache = require('./cache');
const database = require('./database');
const util = require('./util');
const logger = require('../logger');

const { config } = configManager;

const { http: { port } } = config;
const app = express();

const conntest = require('./services/conntest');
const nnid = require('./services/nnid');
const nasc = require('./services/nasc');
const datastore = require('./services/datastore');
const api = require('./services/api');
const localcdn = require('./services/local-cdn');
const assets = require('./services/assets');

// START APPLICATION

// Create router
logger.info('Setting up Middleware');
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({
	extended: true
}));
app.use(xmlparser);

// import the servers into one
app.use(conntest);
app.use(nnid);
app.use(nasc);
app.use(datastore);
app.use(api);
app.use(localcdn);
app.use(assets);

// 404 handler
logger.info('Creating 404 status handler');
app.use((request, response) => {
	const fullUrl = util.fullUrl(request);
	const deviceId = request.headers['X-Nintendo-Device-ID'] || 'Unknown';

	logger.warn(`HTTP 404 at ${fullUrl} from ${deviceId}`);

	response.set('Content-Type', 'text/xml');
	response.set('Server', 'Nintendo 3DS (http)');
	response.set('X-Nintendo-Date', new Date().getTime());

	response.status(404);
	response.send('<errors><error><cause/><code>0008</code><message>Not Found</message></error></errors>');
});

// non-404 error handler
logger.info('Creating non-404 status handler');
app.use((error, request, response) => {
	const status = error.status || 500;
	const fullUrl = util.fullUrl(request);
	const deviceId = request.headers['X-Nintendo-Device-ID'] || 'Unknown';

	logger.warn(`HTTP ${status} at ${fullUrl} from ${deviceId}: ${error.message}`);

	response.status(status);
	response.json({
		app: 'api',
		status,
		error: error.message
	});
});

async function main() {
	// Starts the server
	logger.info('Starting server');

	await database.connect();
	await cache.connect();

	app.listen(port, () => {
		logger.success(`Server started on port ${port}`);
	});
}

main().catch(console.error);