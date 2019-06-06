/*

server.js -
the file that contains the startup code

*/

// imports
const express = require('express');
const subdomain = require('express-subdomain');
const xmlparser = require('express-xml-bodyparser');
const morgan = require('morgan');
const cors = require('cors');
const config = require('./config');
const logger = require('./helpers/logger');
const databaseMiddleware = require('./middleware/database');
const apiErrorCheckMiddleware = require('./middleware/apiErrorCheck');
const PNIDMiddleware = require('./middleware/pnid');

const app = express();
const router = express.Router();

const domainWhitelist = ['http://pretendo.cc'];
const corsOptions = {
	origin: (origin, callback) => {
		if (domainWhitelist.indexOf(origin) !== -1 || !origin) {
			callback(null, true);
		} else {
			callback(new Error('Not allowed by CORS'));
		}
	}
};

app.use(cors(corsOptions));
app.use(xmlparser({
	explicitArray: false
}));
app.use(databaseMiddleware);
app.use(PNIDMiddleware);
app.use(apiErrorCheckMiddleware);

// API routes
logger.info('Importing routes'); 
const ROUTES = {
	ADMIN: require('./routes/admin'),
	DEVICES: require('./routes/devices'),
	OAUTH20: require('./routes/oauth20'),
	PEOPLE: require('./routes/people'),
	PROVIDER: require('./routes/provider'),
};

// START APPLICATION
app.set('etag', false);

// Create router
logger.info('Setting up Middleware');
app.use(morgan('dev'));
router.use(express.json());
//router.use(XMLMiddleware());
router.use(express.urlencoded({
	extended: true
}));

// Create subdomain
logger.info('Creating \'account\' subdomain');
app.use(subdomain('account', router));

// Setup routes
logger.info('Applying imported routes');
router.use('/v1/api/admin', ROUTES.ADMIN);       // Admin API routes
router.use('/v1/api/devices', ROUTES.DEVICES);   // Device API routes
router.use('/v1/api/oauth20', ROUTES.OAUTH20);   // oAuth API routes
router.use('/v1/api/people', ROUTES.PEOPLE);     // People API routes
router.use('/v1/api/provider', ROUTES.PROVIDER); // Provider API routes

// 404 handler
logger.info('Creating 404 status handler');
router.use((request, response) => {
	response.status(404);
	response.send();
});

// non-404 error handler
logger.info('Creating non-404 status handler');
router.use((error, request, response) => {
	const status = error.status || 500;
	response.status(status);
	response.json({
		app: 'api',
		status: status,
		error: error.message
	});
});

// Starts the server
logger.info('Starting server');
app.listen(config.http.port, () => {
	logger.info(`Started server on port: ${config.http.port}`);
});
