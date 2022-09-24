const redis = require('redis');
let client;

async function connect() {
	client = redis.createClient();
	client.on('error', (err) => console.log('Redis Client Error', err));

	await client.connect();
}

// NEX server cache functions

async function getNEXPublicCert(name) {
	const publicCert = await client.get(`nex:${name}:public_cert`);

	if (publicCert !== null) {
		return Buffer.from(publicCert);
	} else {
		return publicCert;
	}
}

async function getNEXPrivateCert(name) {
	const privateCert = await client.get(`nex:${name}:private_cert`);

	if (privateCert !== null) {
		return Buffer.from(privateCert);
	} else {
		return privateCert;
	}
}

async function getNEXSecretKey(name) {
	const secretKey = await client.get(`nex:${name}:secret_key`);

	if (secretKey !== null) {
		return Buffer.from(secretKey);
	} else {
		return secretKey;
	}
}

async function getNEXAESKey(name) {
	const aesKey = await client.get(`nex:${name}:aes_key`);

	if (aesKey !== null) {
		return Buffer.from(aesKey);
	} else {
		return aesKey;
	}
}

async function setNEXPublicCert(name, value) {
	await client.set(`nex:${name}:public_cert`, value);
}

async function setNEXPrivateCert(name, value) {
	await client.set(`nex:${name}:private_cert`, value);
}

async function setNEXSecretKey(name, value) {
	await client.set(`nex:${name}:secret_key`, value);
}

async function setNEXAESKey(name, value) {
	await client.set(`nex:${name}:aes_key`, value);
}

// 3rd party service cache functions

async function getServicePublicCert(name) {
	const publicCert = await client.get(`service:${name}:public_cert`);

	if (publicCert !== null) {
		return Buffer.from(publicCert);
	} else {
		return publicCert;
	}
}

async function getServicePrivateCert(name) {
	const privateCert = await client.get(`service:${name}:private_cert`);

	if (privateCert !== null) {
		return Buffer.from(privateCert);
	} else {
		return privateCert;
	}
}

async function getServiceSecretKey(name) {
	const secretKey = await client.get(`service:${name}:secret_key`);

	if (secretKey !== null) {
		return Buffer.from(secretKey);
	} else {
		return secretKey;
	}
}

async function getServiceAESKey(name) {
	const aesKey = await client.get(`service:${name}:aes_key`);

	if (aesKey !== null) {
		return Buffer.from(aesKey);
	} else {
		return aesKey;
	}
}

async function setServicePublicCert(name, value) {
	await client.set(`service:${name}:public_cert`, value);
}

async function setServicePrivateCert(name, value) {
	await client.set(`service:${name}:private_cert`, value);
}

async function setServiceSecretKey(name, value) {
	await client.set(`service:${name}:secret_key`, value);
}

async function setServiceAESKey(name, value) {
	await client.set(`service:${name}:aes_key`, value);
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