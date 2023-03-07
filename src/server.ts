process.title = 'Pretendo - Account';
process.on('uncaughtException', (err, origin) => {
	console.log(err);
	console.log(origin);
});

import express from 'express';
import morgan from 'morgan';
import xmlparser from '@/middleware/xml-parser';
import cache from '@/cache';
import database from '@/database';
import util from '@/util';
import logger from '@/logger';

import conntest from '@/services/conntest';
import nnid from '@/services/nnid';
import nasc from '@/services/nasc';
import datastore from '@/services/datastore';
import api from '@/services/api';
import localcdn from '@/services/local-cdn';
import assets from '@/services/assets';

import { config } from '@/config-manager';

const { http: { port } } = config;
const app = express();

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
app.use((request: express.Request, response: express.Response) => {
	const fullUrl: string = util.fullUrl(request);
	const deviceId: string = request.headers['X-Nintendo-Device-ID'] as string || 'Unknown';

	logger.warn(`HTTP 404 at ${fullUrl} from ${deviceId}`);

	response.set('Content-Type', 'text/xml');
	response.set('Server', 'Nintendo 3DS (http)');
	response.set('X-Nintendo-Date', new Date().getTime().toString());

	response.status(404);
	response.send('<errors><error><cause/><code>0008</code><message>Not Found</message></error></errors>');
});

// non-404 error handler
logger.info('Creating non-404 status handler');
app.use((error: any, request: express.Request, response: express.Response, _next: express.NextFunction) => {
	const status: number = error.status || 500;
	const fullUrl: string = util.fullUrl(request);
	const deviceId: string = request.headers['X-Nintendo-Device-ID'] as string || 'Unknown';

	logger.warn(`HTTP ${status} at ${fullUrl} from ${deviceId}: ${error.message}`);

	response.status(status);
	response.json({
		app: 'api',
		status,
		error: error.message
	});
});

async function main(): Promise<void> {
	// Starts the server
	logger.info('Starting server');

	await database.connect();
	await cache.connect();

	app.listen(port, () => {
		logger.success(`Server started on port ${port}`);
	});
}

main().catch(console.error);