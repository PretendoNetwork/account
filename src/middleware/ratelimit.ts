import crypto from 'node:crypto';
import ratelimit from 'express-rate-limit';
import { getValueFromHeaders, nascError } from '@/util';
import type express from 'express';

export const deviceRatelimit = ratelimit({
	windowMs: 60 * 1000,
	max: 1,
	keyGenerator: (request: express.Request): string => {
		let data = getValueFromHeaders(request.headers, 'x-nintendo-device-cert');

		if (!data) {
			data = request.ip;
		}

		return crypto.createHash('md5').update(data!).digest('hex');
	}
});

export const loginRatelimit = ratelimit({
	windowMs: 5 * 60 * 1000, // 5mins
	max: 20,
	keyGenerator: (request: express.Request): string => {
		const grantType = request.body?.grant_type;
		const username = request.body?.username?.trim();
		const refreshToken = request.body?.refresh_token?.trim();

		let data = request.ip;
		// Mix in user identification to make CGNAT less harsh
		if (grantType == 'password') {
			data += String(username);
		} else if (grantType == 'refresh_token') {
			data += String(refreshToken);
		}

		return crypto.createHash('md5').update(data!).digest('hex');
	}
});

export const webRegisterRatelimit = ratelimit({
	windowMs: 60 * 1000,
	max: 5, // lax for CGNAT
	keyGenerator: (request: express.Request): string => {
		const data = request.body.ip?.trim(); // forwarded from web

		return crypto.createHash('md5').update(data!).digest('hex');
	}
});

export const passwordResetRatelimit = ratelimit({
	windowMs: 60 * 1000,
	max: 10 // lax for CGNAT
});

export const nascRatelimit = ratelimit({
	windowMs: 5 * 60 * 1000, // 5mins
	max: 30,
	keyGenerator: (request: express.Request): string => {
		const nexAccount = request.nexAccount;
		const pid = nexAccount?.pid ?? 0;

		return String(pid);
	},
	message: nascError('null')
});
