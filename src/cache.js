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

async function getCachedFile(type, name, fileName) {
	const cachedFile = await client.get(`${type}:${name}:${fileName}`);

	if (cachedFile !== null) {
		return Buffer.from(cachedFile);
	} else {
		return cachedFile;
	}
}

// NEX server cache functions

async function getNEXPublicCert(name) {
	return await getCachedFile(`nex:${name}:public_cert`);
}

async function getNEXPrivateCert(name) {
	return await getCachedFile(`nex:${name}:private_cert`);
}

async function getNEXSecretKey(name) {
	return await getCachedFile(`nex:${name}:secret_key`);
}

async function getNEXAESKey(name) {
	return await getCachedFile(`nex:${name}:aes_key`);
}

async function setNEXPublicCert(name, value) {
	await setCachedFile('nex', name, 'public_cert', value);
}

async function setNEXPrivateCert(name, value) {
	await setCachedFile('nex', name, 'private_cert', value);
}

async function setNEXSecretKey(name, value) {
	await setCachedFile('nex', name, 'secret_key', value);
}

async function setNEXAESKey(name, value) {
	await setCachedFile('nex', name, 'aes_key', value);
}

// 3rd party service cache functions

async function getServicePublicCert(name) {
	return await getCachedFile(`service:${name}:public_cert`);
}

async function getServicePrivateCert(name) {
	return await getCachedFile(`service:${name}:private_cert`);
}

async function getServiceSecretKey(name) {
	return await getCachedFile(`service:${name}:secret_key`);
}

async function getServiceAESKey(name) {
	return await getCachedFile(`service:${name}:aes_key`);
}

async function setServicePublicCert(name, value) {
	await setCachedFile('service', name, 'public_cert', value);
}

async function setServicePrivateCert(name, value) {
	await setCachedFile('service', name, 'private_cert', value);
}

async function setServiceSecretKey(name, value) {
	await setCachedFile('service', name, 'secret_key', value);
}

async function setServiceAESKey(name, value) {
	await setCachedFile('service', name, 'aes_key', value);
}

module.exports = {
	connect,
	getNEXPublicCert,
	getNEXPrivateCert,
	getNEXSecretKey,
	getNEXAESKey,
	setNEXPublicCert,
	setNEXPrivateCert,
	setNEXSecretKey,
	setNEXAESKey,
	getServicePublicCert,
	getServicePrivateCert,
	getServiceSecretKey,
	getServiceAESKey,
	setServicePublicCert,
	setServicePrivateCert,
	setServiceSecretKey,
	setServiceAESKey,
};