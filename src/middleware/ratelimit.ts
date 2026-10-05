import crypto from 'node:crypto';
import ratelimit, { MemoryStore } from 'express-rate-limit';
import { getValueFromHeaders, nascError } from '@/util';
import type express from 'express';
import type { Options } from 'express-rate-limit';

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

// * This differs from nascRatelimit in the way that this is keyed by console, not PID, and it's used
// * to still send the clients the banned error code rather than telling them they've been ratelimited,
// * since this is a red flag
// *
// * This is not an express middleware because NASC answers everything with a 200, even on failures.
// * uidhmacs from the old, broken implementation are not counted, those consoles are told to repair their
// * account instead
const FAILED_UIDHMAC_WINDOW = 60 * 60 * 1000; // * 1 hour
const FAILED_UIDHMAC_MAX = 10;

const failedUIDHMACStore = new MemoryStore();

failedUIDHMACStore.init({
	windowMs: FAILED_UIDHMAC_WINDOW
} as Options);

export async function isFailedUIDHMACRatelimited(fcdcertHash: string): Promise<boolean> {
	const hits = await failedUIDHMACStore.get(fcdcertHash);

	return (hits?.totalHits ?? 0) >= FAILED_UIDHMAC_MAX;
}

export async function recordFailedUIDHMAC(fcdcertHash: string): Promise<void> {
	await failedUIDHMACStore.increment(fcdcertHash);
}

export const repairUIDHMACRatelimit = ratelimit({
	windowMs: 5 * 60 * 1000, // 5mins
	max: 30,
	keyGenerator: (request: express.Request): string => {
		const pid = request.body.pid?.trim();

		return String(pid);
	}
});
