import crypto from 'node:crypto';
import ratelimit from 'express-rate-limit';

export default ratelimit({
	windowMs: 60 * 1000,
	max: 1,
	keyGenerator: request => {
		const data = request.headers['x-nintendo-device-cert'];
		return crypto.createHash('md5').update(data).digest('hex');
	}
});