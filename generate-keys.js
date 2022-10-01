const NodeRSA = require('node-rsa');
const crypto = require('crypto');
const fs = require('fs-extra');
const yesno = require('yesno');
const logger = require('./logger');
require('colors');

const ALLOWED_CHARS_REGEX = /[^a-zA-Z0-9_-]/g;

async function main() {
	const args = process.argv.slice(2);

	if (args.length < 1) {
		logger.error('Must pass in type and optional name');
		usage();
		return;
	}

	let [type, name] = args;

	type = type.toLowerCase().trim();

	if (name) {
		name = name.toLowerCase().trim();

		if (ALLOWED_CHARS_REGEX.test(name)) {
			logger.error(`Invalid name. Names must only contain [^a-zA-Z0-9_-]. Got ${name}`);
			return;
		}
	}

	if (!['nex', 'service', 'account'].includes(type)) {
		logger.error(`Invalid type. Expected nex, service, or account. Got ${type}`);
		usage();
		return;
	}

	if (type !== 'account' && (!name || name === '')) {
		logger.error('If type is not account, a name MUST be passed');
		usage();
		return;
	}

	if (type === 'service' && name === 'account') {
		logger.error('Cannot use service name \'account\'. Reserved');
		usage();
		return;
	}

	const path = `${__dirname}/certs/${type}/${name}`;

	if (fs.pathExistsSync(path)) {
		const overwrite = await yesno({
			question: 'Keys found for type name, overwrite existing keys?'
		});

		if (!overwrite) {
			logger.info('Not overwriting existing keys. Exiting program');
			return;
		}
	}

	const publicKeyPath = `${path}/public.pem`;
	const privateKeyPath = `${path}/private.pem`;
	const aesKeyPath = `${path}/aes.key`;
	const secretKeyPath = `${path}/secret.key`;

	// Ensure the output directories exist
	logger.info('Creating output directories...');
	fs.ensureDirSync(path);
	logger.success('Created output directories!');

	const key = new NodeRSA({ b: 1024 }, null, {
		environment: 'browser',
		encryptionScheme: {
			'hash': 'sha256',
		}
	});

	// Generate new key pair
	logger.info('Generating RSA key pair...');
	logger.warn('(this may take a while)')
	key.generateKeyPair(1024);
	logger.success('Generated RSA key pair!');

	// Export the keys
	logger.info('Exporting public key...');
	const publicKey = key.exportKey('public');
	logger.success('Exported public key!');

	// Saving public key
	logger.info('Saving public key to disk...');
	fs.writeFileSync(publicKeyPath, publicKey);
	logger.success(`Saved public key to ${publicKeyPath}!`);

	logger.info('Exporting private key...');
	const privateKey = key.exportKey('private');
	logger.success('Exported private key!');

	// Saving private key
	logger.info('Saving private key to disk...');
	fs.writeFileSync(privateKeyPath, privateKey);
	logger.success(`Saved private key to ${privateKeyPath}!`);

	// Generate new AES key
	logger.info('Generating AES key...');
	const aesKey = crypto.randomBytes(16);
	logger.success('Generated AES key!');

	// Saving AES key
	logger.info('Saving AES key to disk...');
	fs.writeFileSync(aesKeyPath, aesKey.toString('hex'));
	logger.success(`Saved AES key to ${aesKeyPath}!`);

	// Create HMAC secret key
	logger.info('Generating HMAC secret...');
	const secret = crypto.randomBytes(16);
	logger.success('Generated RSA key pair!');

	logger.info('Saving HMAC secret to disk...');
	fs.writeFileSync(secretKeyPath, secret.toString('hex'));
	logger.success(`Saved HMAC secret to ${secretKeyPath}!`);

	logger.success('Keys generated successfully');
}

// Display usage information
function usage() {
	console.log('Usage: node generate-keys.js type [name]');

	console.log('Types:');
	console.log('     - nex');
	console.log('     - service');
	console.log('     - account');

	console.log('Name: Service or NEX server name. Not used in account type');
}

main().catch(logger.error);