const redis = require('redis');
let client;

async function connect() {
	client = redis.createClient();
	client.on('error', (err) => console.log('Redis Client Error', err));

	await client.connect();
}

// NEX server cache functions

async function getNEXPublicCert(name) {
	return Buffer.from(await client.get(`nex:${name}:public_cert`));
}

async function getNEXPrivateCert(name) {
	return Buffer.from(await client.get(`nex:${name}:private_cert`));
}

async function getNEXSecretKey(name) {
	return Buffer.from(await client.get(`nex:${name}:secret_key`));
}

async function getNEXAESKey(name) {
	return Buffer.from(await client.get(`nex:${name}:aes_key`));
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
	return Buffer.from(await client.get(`service:${name}:public_cert`));
}

async function getServicePrivateCert(name) {
	return Buffer.from(await client.get(`service:${name}:private_cert`));
}

async function getServiceSecretKey(name) {
	return Buffer.from(await client.get(`service:${name}:secret_key`));
}

async function getServiceAESKey(name) {
	return Buffer.from(await client.get(`service:${name}:aes_key`));
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