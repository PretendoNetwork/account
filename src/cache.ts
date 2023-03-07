import fs from 'fs-extra';
import redis from 'redis';
import { config, disabledFeatures } from '@/config-manager';

let client: redis.RedisClientType;

const memoryCache: { [key: string]: Buffer } = {};

const SERVICE_CERTS_BASE: string = `${__dirname}/../certs/service`;
const NEX_CERTS_BASE: string = `${__dirname}/../certs/nex`;
const LOCAL_CDN_BASE: string = `${__dirname}/../cdn`;

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
	let cachedFile: Buffer;

	if (disabledFeatures.redis) {
		cachedFile = memoryCache[fileName] || null;
	} else {
		const redisValue: string = await client.get(fileName);
		if (redisValue) {
			cachedFile = Buffer.from(redisValue, encoding);
		}
	}

	return cachedFile;
}

// * NEX server cache functions

export async function getNEXPublicKey(name: string, encoding?: BufferEncoding): Promise<Buffer> {
	let publicKey: Buffer = await getCachedFile(`nex:${name}:public_key`, encoding);

	if (publicKey === null) {
		publicKey = await fs.readFile(`${NEX_CERTS_BASE}/${name}/public.pem`);
		await setNEXPublicKey(name, publicKey);
	}

	return publicKey;
}

export async function getNEXPrivateKey(name: string, encoding?: BufferEncoding): Promise<Buffer> {
	let privateKey: Buffer = await getCachedFile(`nex:${name}:private_key`, encoding);

	if (privateKey === null) {
		privateKey = await fs.readFile(`${NEX_CERTS_BASE}/${name}/private.pem`);
		await setNEXPrivateKey(name, privateKey);
	}

	return privateKey;
}

export async function getNEXSecretKey(name: string, encoding?: BufferEncoding): Promise<Buffer> {
	let secretKey: Buffer = await getCachedFile(`nex:${name}:secret_key`, encoding);

	if (secretKey === null) {
		const fileBuffer: string = await fs.readFile(`${NEX_CERTS_BASE}/${name}/secret.key`, { encoding: 'utf8' });
		secretKey = Buffer.from(fileBuffer, encoding);
		await setNEXSecretKey(name, secretKey);
	}

	return secretKey;
}

export async function getNEXAESKey(name: string, encoding?: BufferEncoding): Promise<Buffer> {
	let aesKey: Buffer = await getCachedFile(`nex:${name}:aes_key`, encoding);

	if (aesKey === null) {
		const fileBuffer: string = await fs.readFile(`${NEX_CERTS_BASE}/${name}/aes.key`, { encoding: 'utf8' });
		aesKey = Buffer.from(fileBuffer, encoding);
		await setNEXAESKey(name, aesKey);
	}

	return aesKey;
}

export async function setNEXPublicKey(name: string, value: Buffer): Promise<void> {
	await setCachedFile(`nex:${name}:public_key`, value);
}

export async function setNEXPrivateKey(name: string, value: Buffer): Promise<void> {
	await setCachedFile(`nex:${name}:private_key`, value);
}

export async function setNEXSecretKey(name: string, value: Buffer): Promise<void> {
	await setCachedFile(`nex:${name}:secret_key`, value);
}

export async function setNEXAESKey(name: string, value: Buffer): Promise<void> {
	await setCachedFile(`nex:${name}:aes_key`, value);
}

// * 3rd party service cache functions

export async function getServicePublicKey(name: string, encoding?: BufferEncoding): Promise<Buffer> {
	let publicKey: Buffer = await getCachedFile(`service:${name}:public_key`, encoding);

	if (publicKey === null) {
		publicKey = await fs.readFile(`${SERVICE_CERTS_BASE}/${name}/public.pem`);
		await setServicePublicKey(name, publicKey);
	}

	return publicKey;
}

export async function getServicePrivateKey(name: string, encoding?: BufferEncoding): Promise<Buffer> {
	let privateKey: Buffer = await getCachedFile(`service:${name}:private_key`, encoding);

	if (privateKey === null) {
		privateKey = await fs.readFile(`${SERVICE_CERTS_BASE}/${name}/private.pem`);
		await setServicePrivateKey(name, privateKey);
	}

	return privateKey;
}

export async function getServiceSecretKey(name: string, encoding?: BufferEncoding): Promise<Buffer> {
	let secretKey: Buffer = await getCachedFile(`service:${name}:secret_key`, encoding);

	if (secretKey === null) {
		const fileBuffer: string = await fs.readFile(`${SERVICE_CERTS_BASE}/${name}/secret.key`, { encoding: 'utf8' });
		secretKey = Buffer.from(fileBuffer, encoding);
		await setServiceSecretKey(name, secretKey);
	}

	return secretKey;
}

export async function getServiceAESKey(name: string, encoding?: BufferEncoding): Promise<Buffer> {
	let aesKey: Buffer = await getCachedFile(`service:${name}:aes_key`, encoding);

	if (aesKey === null) {
		const fileBuffer: string = await fs.readFile(`${SERVICE_CERTS_BASE}/${name}/aes.key`, { encoding: 'utf8' });
		aesKey = Buffer.from(fileBuffer, encoding);
		await setServiceAESKey(name, aesKey);
	}

	return aesKey;
}

export async function setServicePublicKey(name: string, value: Buffer): Promise<void> {
	await setCachedFile(`service:${name}:public_key`, value);
}

export async function setServicePrivateKey(name: string, value: Buffer): Promise<void> {
	await setCachedFile(`service:${name}:private_key`, value);
}

export async function setServiceSecretKey(name: string, value: Buffer): Promise<void> {
	await setCachedFile(`service:${name}:secret_key`, value);
}

export async function setServiceAESKey(name: string, value: Buffer): Promise<void> {
	await setCachedFile(`service:${name}:aes_key`, value);
}

// * Local CDN cache functions

export async function getLocalCDNFile(name: string, encoding?: BufferEncoding): Promise<Buffer> {
	let file: Buffer = await getCachedFile(`local_cdn:${name}`, encoding);

	if (file === null) {
		if (await fs.pathExists(`${LOCAL_CDN_BASE}/${name}`)) {
			const fileBuffer: string = await fs.readFile(`${LOCAL_CDN_BASE}/${name}`, { encoding });
			file = Buffer.from(fileBuffer);
			await setLocalCDNFile(name, file);
		}
	}

	return file;
}

export async function setLocalCDNFile(name: string, value: Buffer): Promise<void> {
	await setCachedFile(`local_cdn:${name}`, value);
}

export default {
	connect,
	getNEXPublicKey,
	getNEXPrivateKey,
	getNEXSecretKey,
	getNEXAESKey,
	setNEXPublicKey,
	setNEXPrivateKey,
	setNEXSecretKey,
	setNEXAESKey,
	getServicePublicKey,
	getServicePrivateKey,
	getServiceSecretKey,
	getServiceAESKey,
	setServicePublicKey,
	setServicePrivateKey,
	setServiceSecretKey,
	setServiceAESKey,
	getLocalCDNFile,
	setLocalCDNFile
};