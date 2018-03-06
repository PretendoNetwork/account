const express = require('express');
const subdomain = require('express-subdomain');
const table = require('cli-table');
const morgan = require('morgan');
const XMLMiddleware = require('./xml-middleware');
const debug = require('./debugger');
const config = require('./config.json');
const app = express();
const router = express.Router();
const testing_env = process.env.NODE_ENV !== 'production';
require('colors');

const server_debugger = new debug('Server');

server_debugger.log('Importing routes'); 
// API routes
const ROUTES = {
	ACCOUNT: require('./routes/account'),
	ADMIN: require('./routes/admin'),
	CONTENT: require('./routes/content'),
	DEVICES: require('./routes/devices'),
	OAUTH20: require('./routes/oauth20'),
	PEOPLE: require('./routes/people'),
	PROVIDER: require('./routes/provider'),
	SUPPORT: require('./routes/support'),
	ROOT: require('./routes/root')
};

// START APPLICATION
app.set('etag', false);

server_debugger.log('Setting up Middleware');
// Create router
app.use(morgan('dev'));
router.use(express.json());
router.use(XMLMiddleware());
router.use(express.urlencoded({
	extended: true
}));

server_debugger.log('Creating \'account\' subdomain');
// Create subdomain
if (testing_env === false) {
	app.use(subdomain('account', router));
} else {
	app.use(router);
}

server_debugger.log('Applying imported routes');
// Setup routes
router.use('/account', ROUTES.ACCOUNT);	         // Account API routes (only used for email confirmation)
router.use('/v1/api/admin', ROUTES.ADMIN);	     // Admin API routes
router.use('/v1/api/content', ROUTES.CONTENT);   // Content API routes
router.use('/v1/api/devices', ROUTES.DEVICES);   // Device API routes
router.use('/v1/api/oauth20', ROUTES.OAUTH20);   // oAuth API routes
router.use('/v1/api/people', ROUTES.PEOPLE);	 // People API routes
router.use('/v1/api/provider', ROUTES.PROVIDER); // Provider API routes
router.use('/v1/api/support', ROUTES.SUPPORT);	 // Support API routes
router.use('/', ROUTES.ROOT);			         // Root/Misc routes

function getRoutes(_router) {
	const ret = [];
	let routes;

	_router.forEach(layer => {
		if (layer.name == 'router') {
			routes = layer;
		}
	});

	const stack = routes.handle.stack;

	stack.forEach(layer => {
		if (layer.handle.stack) {
			const base = layer.regexp.toString()
				.replace('\\/?', '')
				.replace('(?=\\/|$)', '$')
				.match(/^\/\^((?:\\[.*+?^${}()|[\]\\/]|[^.*+?^${}()|[\]\\/])*)\$\//)[1]
				.replace(/\\(.)/g, '$1');

			layer.handle.stack.forEach(mini_layer => {
				ret.push({
					method: Object.keys(mini_layer.route.methods)[0].toUpperCase().replace('_', ''),
					path: base + mini_layer.route.path
				});
			});
		}
	});

	return ret;
}

server_debugger.log('Creating 404 status handler');
// 404 handler
router.use((request, response) => {
	response.status(404);
	response.send();
});

server_debugger.log('Creating non-404 status handler');
// non-404 error handler
router.use((error, request, response) => {
	const status = error.status || 500;
	response.status(status);
	response.json({
		app: 'api',
		status: status,
		error: error.message
	});
});



server_debugger.log('Starting server');
// Starts the server
app.listen(config.http.port, () => {
	const route_table = new table({
		head: ['Method', 'Path']
	});
	const routes = getRoutes(app._router.stack);

	routes.forEach(route => {
		const obj = {};
		obj[route.method] = route.path;

		route_table.push(obj);
	});

	console.log(route_table.toString());

	server_debugger.log('Started '.green + 'on port '.blue + new String(config.http.port).yellow);
});
