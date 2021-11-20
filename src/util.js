const crypto = require('crypto');
const NodeRSA = require('node-rsa');
const fs = require('fs-extra');
const aws = require('aws-sdk');
const config = require('./config.json');

const spacesEndpoint = new aws.Endpoint('nyc3.digitaloceanspaces.com');
const s3 = new aws.S3({
	endpoint: spacesEndpoint,
	accessKeyId: config.aws.spaces.key,
	secretAccessKey: config.aws.spaces.secret
});

function nintendoPasswordHash(password, pid) {
	const pidBuffer = Buffer.alloc(4);
	pidBuffer.writeUInt32LE(pid);

	const unpacked = Buffer.concat([
		pidBuffer,
		Buffer.from('\x02\x65\x43\x46'),
		Buffer.from(password)
	]);
	const hashed = crypto.createHash('sha256').update(unpacked).digest().toString('hex');

	return hashed;
}

function nintendoBase64Decode(encoded) {
	encoded = encoded.replaceAll('.', '+').replaceAll('-', '/').replaceAll('*', '=');
	return Buffer.from(encoded, 'base64').toString();
}

function nintendoBase64Encode(decoded) {
	const encoded = Buffer.from(decoded).toString('base64');
	return encoded.replaceAll('+', '.').replaceAll('/', '-').replaceAll('=', '*');
}

function generateToken(cryptoOptions, tokenOptions) {

	// Access and refresh tokens use a different format since they must be much smaller
	if ([0x1, 0x2].includes(tokenOptions.token_type)) {
		const cryptoPath = `${__dirname}/../certs/access`;
		const aesKey = Buffer.from(fs.readFileSync(`${cryptoPath}/aes.key`, { encoding: 'utf8' }), 'hex');
		const dataBuffer = Buffer.alloc(1 + 1 + 4 + 8);

		dataBuffer.writeUInt8(tokenOptions.system_type, 0x0);
		dataBuffer.writeUInt8(tokenOptions.token_type, 0x1);
		dataBuffer.writeUInt32LE(tokenOptions.pid, 0x2);
		dataBuffer.writeBigUInt64LE(tokenOptions.expire_time, 0x6);

		const iv = Buffer.alloc(16);
		const cipher = crypto.createCipheriv('aes-128-cbc', aesKey, iv);

		let encryptedBody = cipher.update(dataBuffer);
		encryptedBody = Buffer.concat([encryptedBody, cipher.final()]);

		return encryptedBody.toString('base64');
	}

	const publicKey = new NodeRSA(cryptoOptions.public_key, 'pkcs8-public-pem', {
		environment: 'browser',
		encryptionScheme: {
			'hash': 'sha256',
		}
	});

	// Create the buffer containing the token data
	const dataBuffer = Buffer.alloc(1 + 1 + 4 + 8 + 8);

	dataBuffer.writeUInt8(tokenOptions.system_type, 0x0);
	dataBuffer.writeUInt8(tokenOptions.token_type, 0x1);
	dataBuffer.writeUInt32LE(tokenOptions.pid, 0x2);
	dataBuffer.writeBigUInt64LE(tokenOptions.title_id, 0x6);
	dataBuffer.writeBigUInt64LE(tokenOptions.expire_time, 0xE);

	// Calculate the signature of the token body
	const hmac = crypto.createHmac('sha1', cryptoOptions.hmac_secret).update(dataBuffer);
	const signature = hmac.digest();

	// You can thank the 3DS for the shit thats about to happen with the AES IV
	// The 3DS only allows for strings up to 255 characters in NEX
	// So this is done to reduce the token size as much as possible
	// I am sorry, and have already asked every God I could think of for forgiveness

	// Generate random AES key
	const key = crypto.randomBytes(16);

	// Encrypt the AES key with RSA public key
	const encryptedKey = publicKey.encrypt(key);

	// Take two random points in the RSA encrypted key
	const point1 = ~~((encryptedKey.length - 8) * Math.random());
	const point2 = ~~((encryptedKey.length - 8) * Math.random());

	// Build an IV from each of the two points
	const iv = Buffer.concat([
		Buffer.from(encryptedKey.subarray(point1, point1 + 8)),
		Buffer.from(encryptedKey.subarray(point2, point2 + 8))
	]);

	const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);

	// Encrypt the token body with AES
	let encryptedBody = cipher.update(dataBuffer);
	encryptedBody = Buffer.concat([encryptedBody, cipher.final()]);

	// Create crypto config token section
	const cryptoConfig = Buffer.concat([
		encryptedKey,
		Buffer.from([point1, point2])
	]);

	// Build the token
	const token = Buffer.concat([
		cryptoConfig,
		signature,
		encryptedBody
	]);

	return token.toString('base64'); // Encode to base64 for transport
}

function decryptToken(token) {

	// Access and refresh tokens use a different format since they must be much smaller
	// Assume a small length means access or refresh token
	if (token.length <= 32) {
		const cryptoPath = `${__dirname}/../certs/access`;
		const aesKey = Buffer.from(fs.readFileSync(`${cryptoPath}/aes.key`, { encoding: 'utf8' }), 'hex');

		const iv = Buffer.alloc(16);

		const decipher = crypto.createDecipheriv('aes-128-cbc', aesKey, iv);

		let decryptedBody = decipher.update(token);
		decryptedBody = Buffer.concat([decryptedBody, decipher.final()]);

		return decryptedBody;
	}

	const cryptoPath = `${__dirname}/../certs/access`;

	const cryptoOptions = {
		private_key: fs.readFileSync(`${cryptoPath}/private.pem`),
		hmac_secret: fs.readFileSync(`${cryptoPath}/secret.key`)
	};

	const privateKey = new NodeRSA(cryptoOptions.private_key, 'pkcs1-private-pem', {
		environment: 'browser',
		encryptionScheme: {
			'hash': 'sha256',
		}
	});

	const cryptoConfig = token.subarray(0, 0x82);
	const signature = token.subarray(0x82, 0x96);
	const encryptedBody = token.subarray(0x96);

	const encryptedAESKey = cryptoConfig.subarray(0, 128);
	const point1 = cryptoConfig.readInt8(0x80);
	const point2 = cryptoConfig.readInt8(0x81);

	const iv = Buffer.concat([
		Buffer.from(encryptedAESKey.subarray(point1, point1 + 8)),
		Buffer.from(encryptedAESKey.subarray(point2, point2 + 8))
	]);

	const decryptedAESKey = privateKey.decrypt(encryptedAESKey);

	const decipher = crypto.createDecipheriv('aes-128-cbc', decryptedAESKey, iv);

	let decryptedBody = decipher.update(encryptedBody);
	decryptedBody = Buffer.concat([decryptedBody, decipher.final()]);

	const hmac = crypto.createHmac('sha1', cryptoOptions.hmac_secret).update(decryptedBody);
	const calculatedSignature = hmac.digest();

	if (calculatedSignature !== signature) {
		console.log('Token signature did not match');
		return null;
	}

	return decryptedBody;
}

function unpackToken(token) {
	if (token.length <= 32) {
		return {
			system_type: token.readUInt8(0x0),
			token_type: token.readUInt8(0x1),
			pid: token.readUInt32LE(0x2),
			expire_time: token.readBigUInt64LE(0x6)
		};
	}

	return {
		system_type: token.readUInt8(0x0),
		token_type: token.readUInt8(0x1),
		pid: token.readUInt32LE(0x2),
		title_id: token.readBigUInt64LE(0x6),
		expire_time: token.readBigUInt64LE(0xE)
	};
}

function fullUrl(request) {
	const protocol = request.protocol;
	const host = request.host;
	const path = request.originalUrl;

	return `${protocol}://${host}${path}`;
}

async function uploadCDNAsset(bucket, key, data, acl) {
	const awsPutParams = {
		Body: data,
		Key: key,
		Bucket: bucket,
		ACL: acl
	};

	await s3.putObject(awsPutParams).promise();
}

module.exports = {
	nintendoPasswordHash,
	nintendoBase64Decode,
	nintendoBase64Encode,
	generateToken,
	decryptToken,
	unpackToken,
	fullUrl,
	uploadCDNAsset
};