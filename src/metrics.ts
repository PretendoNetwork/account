import { format } from 'node:util';
import expressMetrics from 'express-prom-bundle';
import express from 'express';
import { LOG_ERROR, LOG_INFO, LOG_SUCCESS } from '@/logger';
import { config } from '@/config-manager';
import type { Express, NextFunction, Request, Response } from 'express';

export function registerMetrics(app: Express): Express {
	const metrics = express();

	if (config.metrics.enabled) {
		LOG_INFO('Setting up metrics');
		app.use(expressMetrics({
			// * Include full express and nodejs metrics
			includeMethod: true,
			includePath: true,
			urlValueParser: {
				minBase64Length: 15
			},
			promClient: {
				collectDefaultMetrics: {}
			},

			// * Keep metrics on a different app (so they aren't exposed)
			autoregister: false,
			metricsApp: metrics
		}));
	}

	metrics.use((error: Error, req: Request, res: Response, _next: NextFunction) => {
		LOG_ERROR(`Request failed (metrics): ${format(error)}`);
		res.sendStatus(500);
	});

	return metrics;
}

export function listenMetrics(metricsApp: Express): void {
	if (!config.metrics.enabled) {
		return;
	}

	const port = config.metrics.port;
	metricsApp.listen(port, () => {
		LOG_SUCCESS(`Metrics HTTP server started on port ${port}`);
	});
}
