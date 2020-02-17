const NodeRSA = require('node-rsa');
const crypto = require('crypto');
const fs = require('fs-extra');
require('colors');

const args = process.argv.slice(2);

if (args.length < 1) {
	usage();
	return;
}

const [type, name] = args;

if (!['nex', 'service', 'access'].includes(type)) {
	usage();
	return;
}

if (type !== 'access' && (!name || name.trim() === '')) {
	usage();
	return;
}

let path;

if (type === 'access') {
	path = `${__dirname}/certs/${type}`;
} else {
	path = `${__dirname}/certs/${type}/${name}`;
}

// Ensure the output directories exist
console.log('Creating output directories'.brightGreen);
fs.ensureDirSync(path);

// Generate new AES key
console.log('Generating AES key'.brightGreen);
const aesKey = crypto.randomBytes(16);

// Saving AES key
fs.writeFileSync(`${path}/aes.key`, aesKey.toString('hex'));
console.log(`Saved AES key to file ${path}/aes.key`.brightBlue);

const key = new NodeRSA({ b: 1024}, null, {
	environment: 'browser',
	encryptionScheme: {
		'hash': 'sha256',
	}
});

// Generate new key pair
console.log('Generating RSA key pair'.brightGreen, '(this may take a while)'.yellow.bold);
key.generateKeyPair(1024);

// Export the keys
console.log('Exporting public key'.brightGreen);
const publickKey = key.exportKey('public');

// Saving public key
fs.writeFileSync(`${path}/public.pem`, publickKey);
console.log(`Saved public key to file ${path}/public.pem`.brightBlue);

console.log('Exporting private key'.brightGreen);
const privatekKey = key.exportKey('private');

// Saving private key
fs.writeFileSync(`${path}/private.pem`, privatekKey);
console.log(`Saved public key to file ${path}/private.pem`.brightBlue);

// Create HMAC secret key
console.log('Generating HMAC secret'.brightGreen);
const secret = crypto.randomBytes(16);
fs.writeFileSync(`${path}/secret.key`, secret.toString('hex'));

console.log(`Saved HMAC secret to file ${path}/secret.key`.brightBlue);

// Display usage information
function usage() {
	console.log('Usage: node generate-keys.js type [name]');

	console.log('Types:');
	console.log('     - nex');
	console.log('     - service');
	console.log('     - access');

	console.log('Name: service or nex server name. Not used in access type');
}