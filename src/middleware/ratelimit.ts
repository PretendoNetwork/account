import crypto from 'node:crypto';
import express from 'express';
import ratelimit from 'express-rate-limit';

export default ratelimit({
	windowMs: 60 * 1000,
	max: 1,
	keyGenerator: (request: express.Request) => {
		const data: string = request.headers['x-nintendo-device-cert'] as string;
		return crypto.createHash('md5').update(data).digest('hex');
	}
});