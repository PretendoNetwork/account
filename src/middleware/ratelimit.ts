import crypto from 'node:crypto';
import express from 'express';
import ratelimit from 'express-rate-limit';
import { getValueFromHeaders } from '@/util';

export default ratelimit({
	windowMs: 60 * 1000,
	max: 1,
	keyGenerator: (request: express.Request): string => {
		let data = getValueFromHeaders(request.headers, 'x-nintendo-device-cert');

		if (!data) {
			data = request.ip;
		}

		return crypto.createHash('md5').update(data).digest('hex');
	}
});