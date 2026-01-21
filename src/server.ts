import express from 'express';
import morgan from 'morgan';
import xmlbuilder from 'xmlbuilder';
import xmlparser from '@/middleware/xml-parser';
import { connect as connectCache } from '@/cache';
import { checkMarkedDeletions, connect as connectDatabase } from '@/database';
import { startGRPCServer } from '@/services/grpc/server';
import { fullUrl, getValueFromHeaders } from '@/util';
import { LOG_INFO, LOG_SUCCESS, LOG_WARN } from '@/logger';
import conntest from '@/services/conntest';
import cbvc from '@/services/cbvc';
import nnas from '@/services/nnas';
import nasc from '@/services/nasc';
import datastore from '@/services/datastore';
import api from '@/services/api';
import localcdn from '@/services/local-cdn';
import assets from '@/services/assets';
import { config, disabledFeatures } from '@/config-manager';
import { startProvisioner } from './provisioning';

process.title = 'Pretendo - Account';
process.on('uncaughtException', (err, origin) => {
	console.log(err);
	console.log(origin);
});
process.on('SIGTERM', () => {
	process.exit(0);
});

const app = express();

// * START APPLICATION
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.set('trust proxy', true); // TODO - Make this configurable

// * Create router
LOG_INFO('Setting up Middleware');
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({
	extended: true
}));
app.use(xmlparser);

// * import the servers into one
app.use(conntest);
app.use(cbvc);
app.use(nnas);
app.use(nasc);
app.use(api);
app.use(localcdn);
app.use(assets);

if (!disabledFeatures.datastore) {
	app.use(datastore);
}

// * 404 handler
LOG_INFO('Creating 404 status handler');
app.use((request: express.Request, response: express.Response): void => {
	const url = fullUrl(request);
	let deviceID = getValueFromHeaders(request.headers, 'X-Nintendo-Device-ID');

	if (!deviceID) {
		deviceID = 'Unknown';
	}

	LOG_WARN(`HTTP 404 at ${url} from ${deviceID}`);

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

// * non-404 error handler
LOG_INFO('Creating non-404 status handler');
app.use((error: any, request: express.Request, response: express.Response, _next: express.NextFunction): void => {
	const status = error.status || 500;
	const url = fullUrl(request);
	let deviceID = getValueFromHeaders(request.headers, 'X-Nintendo-Device-ID');

	if (!deviceID) {
		deviceID = 'Unknown';
	}

	LOG_WARN(`HTTP ${status} at ${url} from ${deviceID}: ${error.message}`);

	response.status(status).json({
		app: 'api',
		status,
		error: error.message
	});
});

async function main(): Promise<void> {
	// * Starts the server
	LOG_INFO('Starting server');

	await connectDatabase();
	LOG_SUCCESS('Database connected');
	await connectCache();
	LOG_SUCCESS('Cache enabled');
	await startGRPCServer();
	LOG_SUCCESS(`gRPC server started on port ${config.grpc.port}`);

	startProvisioner();

	await checkMarkedDeletions();

	app.listen(config.http.port, () => {
		LOG_SUCCESS(`HTTP server started on port ${config.http.port}`);
	});
}

main().catch(console.error);
