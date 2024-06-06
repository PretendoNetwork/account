import fs from 'fs-extra';
import redis from 'redis';
import { config, disabledFeatures } from '@/config-manager';

let client: redis.RedisClientType;

const memoryCache: Record<string, Buffer> = {};

const LOCAL_CDN_BASE = `${__dirname}/../cdn`;

export async function connect(): Promise<void> {
	if (!disabledFeatures.redis) {
		client = redis.createClient(config.redis.client);
		client.on('error', (err) => console.log('Redis Client Error', err));

		await client.connect();
	}
}

export async function setCachedFile(fileName: string, value: Buffer): Promise<void> {
	if (disabledFeatures.redis) {
		memoryCache[fileName] = value;
	} else {
		await client.set(fileName, value);
	}
}

export async function getCachedFile(fileName: string, encoding?: BufferEncoding): Promise<Buffer> {
	let cachedFile = Buffer.alloc(0);

	if (disabledFeatures.redis) {
		cachedFile = memoryCache[fileName] || null;
	} else {
		const redisValue = await client.get(fileName);
		if (redisValue) {
			cachedFile = Buffer.from(redisValue, encoding);
		}
	}

	return cachedFile;
}

// * Local CDN cache functions

export async function getLocalCDNFile(name: string, encoding?: BufferEncoding): Promise<Buffer> {
	let file = await getCachedFile(`local_cdn:${name}`, encoding);

	if (file === null) {
		if (await fs.pathExists(`${LOCAL_CDN_BASE}/${name}`)) {
			const fileBuffer = await fs.readFile(`${LOCAL_CDN_BASE}/${name}`, { encoding });
			file = Buffer.from(fileBuffer);
			await setLocalCDNFile(name, file);
		}
	}

	return file;
}

export async function setLocalCDNFile(name: string, value: Buffer): Promise<void> {
	await setCachedFile(`local_cdn:${name}`, value);
}