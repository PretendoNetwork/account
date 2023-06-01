process.title = 'Pretendo - Account';
process.on('uncaughtException', (err, origin) => {
	console.log(err);
	console.log(origin);
});

import express from 'express';
import morgan from 'morgan';
import xmlbuilder from 'xmlbuilder';
import xmlparser from '@/middleware/xml-parser';
import { connect as connectCache } from '@/cache';
import { connect as connectDatabase } from '@/database';
import { startGRPCServer } from '@/services/grpc/server';
import { fullUrl, getValueFromHeaders } from '@/util';
import { LOG_INFO, LOG_SUCCESS, LOG_WARN } from '@/logger';

import conntest from '@/services/conntest';
import nnid from '@/services/nnid';
import nasc from '@/services/nasc';
import datastore from '@/services/datastore';
import api from '@/services/api';
import localcdn from '@/services/local-cdn';
import assets from '@/services/assets';

import { config } from '@/config-manager';

const app: express.Express = express();

// START APPLICATION

// Create router
LOG_INFO('Setting up Middleware');
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
LOG_INFO('Creating 404 status handler');
app.use((request: express.Request, response: express.Response): void => {
	const url: string = fullUrl(request);
	let deviceId: string | undefined = getValueFromHeaders(request.headers, 'X-Nintendo-Device-ID');

	if (!deviceId) {
		deviceId = 'Unknown';
	}

	LOG_WARN(`HTTP 404 at ${url} from ${deviceId}`);

	response.set('Content-Type', 'text/xml');
	response.set('Server', 'Nintendo 3DS (http)');
	response.set('X-Nintendo-Date', new Date().getTime().toString());

	response.status(404).send(xmlbuilder.create({
		errors: {
			error: {
				cause: '',
				code: '0008',
				message: 'Not Found'
			}
		}
	}).end());
});

// non-404 error handler
LOG_INFO('Creating non-404 status handler');
app.use((error: any, request: express.Request, response: express.Response, _next: express.NextFunction): void => {
	const status: number = error.status || 500;
	const url: string = fullUrl(request);
	let deviceId: string | undefined = getValueFromHeaders(request.headers, 'X-Nintendo-Device-ID');

	if (!deviceId) {
		deviceId = 'Unknown';
	}

	LOG_WARN(`HTTP ${status} at ${url} from ${deviceId}: ${error.message}`);

	response.status(status).json({
		app: 'api',
		status,
		error: error.message
	});
});

async function main(): Promise<void> {
	// Starts the server
	LOG_INFO('Starting server');

	await connectDatabase();
	LOG_SUCCESS('Database connected');
	await connectCache();
	LOG_SUCCESS('Cache enabled');
	await startGRPCServer();
	LOG_SUCCESS(`gRPC server started on port ${config.grpc.port}`);

	app.listen(config.http.port, () => {
		LOG_SUCCESS(`HTTP server started on port ${config.http.port}`);
	});
}

main().catch(console.error);