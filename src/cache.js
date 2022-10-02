const fs = require('fs-extra');
const redis = require('redis');
const config = require('../config.json');
let client;

const SERVICE_CERTS_BASE = `${__dirname}/../certs/service`;
const NEX_CERTS_BASE = `${__dirname}/../certs/nex`;

async function connect() {
	client = redis.createClient(config.redis.client);
	client.on('error', (err) => console.log('Redis Client Error', err));

	await client.connect();
}

async function setCachedFile(type, name, fileName, value) {
	await client.set(`${type}:${name}:${fileName}`, value);
}

async function getCachedFile(type, name, fileName, encoding) {
	const cachedFile = await client.get(`${type}:${name}:${fileName}`);

	if (cachedFile !== null) {
		return Buffer.from(cachedFile, encoding);
	} else {
		return cachedFile;
	}
}

// NEX server cache functions

async function getNEXPublicKey(name, encoding) {
	let publicKey = await getCachedFile(`nex:${name}:public_key`, encoding);

	if (publicKey === null) {
		publicKey = await fs.readFile(`${NEX_CERTS_BASE}/${name}/public.pem`, { encoding });
		await setNEXPublicKey(name, publicKey);
	}

	return publicKey;
}

async function getNEXPrivateKey(name, encoding) {
	let privateKey = await getCachedFile(`nex:${name}:private_key`, encoding);

	if (privateKey === null) {
		privateKey = await fs.readFile(`${NEX_CERTS_BASE}/${name}/private.pem`, { encoding });
		await setNEXPrivateKey(name, privateKey);
	}

	return privateKey;
}

async function getNEXSecretKey(name, encoding) {
	let secretKey = await getCachedFile(`nex:${name}:secret_key`, encoding);

	if (secretKey === null) {
		const fileBuffer = await fs.readFile(`${NEX_CERTS_BASE}/${name}/secret.key`, { encoding: 'utf8' });
		secretKey = Buffer.from(fileBuffer, encoding);
		await setNEXSecretKey(name, secretKey);
	}

	return secretKey;
}

async function getNEXAESKey(name, encoding) {
	let aesKey = await getCachedFile(`nex:${name}:aes_key`, encoding);

	if (aesKey === null) {
		const fileBuffer = await fs.readFile(`${NEX_CERTS_BASE}/${name}/aes.key`, { encoding: 'utf8' });
		aesKey = Buffer.from(fileBuffer, encoding);
		await setNEXAESKey(name, aesKey);
	}

	return secretKey;
}

async function setNEXPublicKey(name, value) {
	await setCachedFile('nex', name, 'public_key', value);
}

async function setNEXPrivateKey(name, value) {
	await setCachedFile('nex', name, 'private_key', value);
}

async function setNEXSecretKey(name, value) {
	await setCachedFile('nex', name, 'secret_key', value);
}

async function setNEXAESKey(name, value) {
	await setCachedFile('nex', name, 'aes_key', value);
}

// 3rd party service cache functions

async function getServicePublicKey(name, encoding) {
	let publicKey = await getCachedFile(`service:${name}:public_key`, encoding);

	if (publicKey === null) {
		publicKey = await fs.readFile(`${SERVICE_CERTS_BASE}/${name}/public.pem`, { encoding });
		await setServicePublicKey(name, publicKey);
	}

	return publicKey;
}

async function getServicePrivateKey(name, encoding) {
	let privateKey = await getCachedFile(`service:${name}:private_key`, encoding);

	if (privateKey === null) {
		privateKey = await fs.readFile(`${SERVICE_CERTS_BASE}/${name}/private.pem`, { encoding });
		await setServicePrivateKey(name, privateKey);
	}

	return privateKey;
}

async function getServiceSecretKey(name, encoding) {
	let secretKey = await getCachedFile(`service:${name}:secret_key`, encoding);

	if (secretKey === null) {
		const fileBuffer = await fs.readFile(`${SERVICE_CERTS_BASE}/${name}/secret.key`, { encoding: 'utf8' });
		secretKey = Buffer.from(fileBuffer, encoding);
		await setServiceSecretKey(name, secretKey);
	}

	return secretKey;
}

async function getServiceAESKey(name, encoding) {
	let aesKey = await getCachedFile(`service:${name}:aes_key`, encoding);

	if (aesKey === null) {
		const fileBuffer = await fs.readFile(`${SERVICE_CERTS_BASE}/${name}/aes.key`, { encoding: 'utf8' });
		aesKey = Buffer.from(fileBuffer, encoding);
		await setServiceAESKey(name, aesKey);
	}

	return aesKey;
}

async function setServicePublicKey(name, value) {
	await setCachedFile('service', name, 'public_key', value);
}

async function setServicePrivateKey(name, value) {
	await setCachedFile('service', name, 'private_key', value);
}

async function setServiceSecretKey(name, value) {
	await setCachedFile('service', name, 'secret_key', value);
}

async function setServiceAESKey(name, value) {
	await setCachedFile('service', name, 'aes_key', value);
}

module.exports = {
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
};