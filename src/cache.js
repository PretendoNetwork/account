const redis = require('redis');
let client;

async function connect() {
	client = redis.createClient();
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
	return await getCachedFile(`nex:${name}:public_key`, encoding);
}

async function getNEXPrivateKey(name, encoding) {
	return await getCachedFile(`nex:${name}:private_key`, encoding);
}

async function getNEXSecretKey(name, encoding) {
	return await getCachedFile(`nex:${name}:secret_key`, encoding);
}

async function getNEXAESKey(name, encoding) {
	return await getCachedFile(`nex:${name}:aes_key`, encoding);
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
	return await getCachedFile(`service:${name}:public_key`, encoding);
}

async function getServicePrivateKey(name, encoding) {
	return await getCachedFile(`service:${name}:private_key`, encoding);
}

async function getServiceSecretKey(name, encoding) {
	return await getCachedFile(`service:${name}:secret_key`, encoding);
}

async function getServiceAESKey(name, encoding) {
	return await getCachedFile(`service:${name}:aes_key`, encoding);
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