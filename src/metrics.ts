import { format } from 'node:util';
import { Gauge } from 'prom-client';
import expressMetrics from 'express-prom-bundle';
import express from 'express';
import { LOG_ERROR, LOG_INFO, LOG_SUCCESS } from '@/logger';
import { config } from '@/config-manager';
import { PNID } from '@/models/pnid';
import { NEXToken } from '@/models/nex-token';
import type { Express, NextFunction, Request, Response } from 'express';

export const pnidTotalGauge = new Gauge({
	name: 'pn_account_pnid_total',
	help: 'Total number of registered PNIDs',
	async collect(): Promise<void> {
		// * Aggregations are faster on large collections
		const [result] = await PNID.aggregate<{ n: number } | undefined>([
			{ $match: { deleted: false } },
			{ $count: 'n' }
		]);
		this.set(result?.n ?? 0);
	}
});

export const nexTokenTotalGauge = new Gauge({
	name: 'pn_account_nex_token_total',
	help: 'Total number of NEX tokens',
	async collect(): Promise<void> {
		// * Aggregations are faster on large collections
		const [result] = await NEXToken.aggregate<{ n: number } | undefined>([
			{ $count: 'n' }
		]);
		this.set(result?.n ?? 0);
	}
});

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
