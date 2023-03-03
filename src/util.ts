const crypto = require('crypto');
const path = require('path');
const NodeRSA = require('node-rsa');
const aws = require('aws-sdk');
const fs = require('fs-extra');
const mailer = require('./mailer');
const cache = require('./cache');
const { config, disabledFeatures } = require('./config-manager');

let s3;

if (!disabledFeatures.s3) {
	s3 = new aws.S3({
		endpoint: new aws.Endpoint(config.s3.endpoint),
		accessKeyId: config.s3.key,
		secretAccessKey: config.s3.secret
	});
}

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
	return Buffer.from(encoded, 'base64');
}

function nintendoBase64Encode(decoded) {
	const encoded = Buffer.from(decoded).toString('base64');
	return encoded.replaceAll('+', '.').replaceAll('/', '-').replaceAll('=', '*');
}

async function generateToken(cryptoOptions, tokenOptions) {

	// Access and refresh tokens use a different format since they must be much smaller
	// They take no extra crypto options
	if (!cryptoOptions) {
		const aesKey = await cache.getServiceAESKey('account', 'hex');

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
	const dataBuffer = Buffer.alloc(1 + 1 + 4 + 1 + 8 + 8);

	dataBuffer.writeUInt8(tokenOptions.system_type, 0x0);
	dataBuffer.writeUInt8(tokenOptions.token_type, 0x1);
	dataBuffer.writeUInt32LE(tokenOptions.pid, 0x2);
	dataBuffer.writeUInt8(tokenOptions.access_level, 0x6);
	dataBuffer.writeBigUInt64LE(tokenOptions.title_id, 0x7);
	dataBuffer.writeBigUInt64LE(tokenOptions.expire_time, 0xF);

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

async function decryptToken(token) {
	// Access and refresh tokens use a different format since they must be much smaller
	// Assume a small length means access or refresh token
	if (token.length <= 32) {
		const aesKey = await cache.getServiceAESKey('account', 'hex');

		const iv = Buffer.alloc(16);

		const decipher = crypto.createDecipheriv('aes-128-cbc', aesKey, iv);

		let decryptedBody = decipher.update(token);
		decryptedBody = Buffer.concat([decryptedBody, decipher.final()]);

		return decryptedBody;
	}

	const privateKeyBytes = await cache.getServicePrivateKey('account');
	const secretKey = await cache.getServiceSecretKey('account');

	const privateKey = new NodeRSA(privateKeyBytes, 'pkcs1-private-pem', {
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

	const hmac = crypto.createHmac('sha1', secretKey).update(decryptedBody);
	const calculatedSignature = hmac.digest();

	if (!signature.equals(calculatedSignature)) {
		console.log('Token signature did not match');
		return null;
	}

	return decryptedBody;
}

function unpackToken(token) {
	if (token.length <= 14) {
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
		access_level: token.readUInt8(0x6),
		title_id: token.readBigUInt64LE(0x7),
		expire_time: token.readBigUInt64LE(0xF)
	};
}

function fullUrl(request) {
	const protocol = request.protocol;
	const host = request.host;
	const opath = request.originalUrl;

	return `${protocol}://${host}${opath}`;
}

async function uploadCDNAsset(bucket, key, data, acl) {
	if (disabledFeatures.s3) {
		await writeLocalCDNFile(key, data);
	} else {
		const awsPutParams = {
			Body: data,
			Key: key,
			Bucket: bucket,
			ACL: acl
		};

		await s3.putObject(awsPutParams).promise();
	}
}

async function writeLocalCDNFile(key, data) {
	const filePath = config.cdn.disk_path;
	const folder = path.dirname(filePath);

	await fs.ensureDir(folder);
	await fs.writeFile(filePath, data);
}

function nascError(errorCode) {
	const params = new URLSearchParams({
		retry: nintendoBase64Encode('1'),
		returncd: errorCode == 'null' ? errorCode : nintendoBase64Encode(errorCode),
		datetime: nintendoBase64Encode(Date.now().toString()),
	});

	return params;
}

async function sendConfirmationEmail(pnid) {
	await mailer.sendMail({
		to: pnid.get('email.address'),
		subject: '[Pretendo Network] Please confirm your email address',
		username: pnid.get('username'),
		confirmation: {
			href: `https://api.pretendo.cc/v1/email/verify?token=${pnid.get('identification.email_token')}`,
			code: pnid.get('identification.email_code')
		},
		text: `Hello ${pnid.get('username')}! \r\n\r\nYour Pretendo Network ID activation is almost complete. Please click the link to confirm your e-mail address and complete the activation process: \r\nhttps://api.pretendo.cc/v1/email/verify?token=${pnid.get('identification.email_token')} \r\n\r\nYou may also enter the following 6-digit code on your console: ${pnid.get('identification.email_code')}`
	});

}

async function sendEmailConfirmedEmail(pnid) {
	await mailer.sendMail({
		to: pnid.get('email.address'),
		subject: '[Pretendo Network] Email address confirmed',
		username: pnid.get('username'),
		paragraph: 'your email address has been confirmed. We hope you have fun on Pretendo Network!',
		text: `Dear ${pnid.get('username')}, \r\n\r\nYour email address has been confirmed. We hope you have fun on Pretendo Network!`
	});
}

async function sendForgotPasswordEmail(pnid) {
	const publicKey = await cache.getServicePublicKey('account');
	const secretKey = await cache.getServiceSecretKey('account');

	const cryptoOptions = {
		public_key: publicKey,
		hmac_secret: secretKey
	};

	const tokenOptions = {
		system_type: 0xF, // API
		token_type: 0x5, // Password reset
		pid: pnid.get('pid'),
		access_level: pnid.get('access_level'),
		title_id: BigInt(0),
		expire_time: BigInt(Date.now() + (24 * 60 * 60 * 1000)) // Only valid for 24 hours
	};

	const passwordResetToken = await generateToken(cryptoOptions, tokenOptions);

	await mailer.sendMail({
		to: pnid.get('email.address'),
		subject: '[Pretendo Network] Forgot Password',
		username: pnid.get('username'),
		paragraph: 'a password reset has been requested from this account. If you did not request the password reset, please ignore this email. If you did request this password reset, please click the link below to reset your password.',
		link: {
			text: 'Reset password',
			href: `${config.website_base}/account/reset-password?token=${encodeURIComponent(passwordResetToken)}`
		},
		text: `Dear ${pnid.get('username')}, a password reset has been requested from this account. \r\n\r\nIf you did not request the password reset, please ignore this email. \r\nIf you did request this password reset, please click the link to reset your password: ${config.website_base}/account/reset-password?token=${encodeURIComponent(passwordResetToken)}`
	});
}

export default {
	nintendoPasswordHash,
	nintendoBase64Decode,
	nintendoBase64Encode,
	generateToken,
	decryptToken,
	unpackToken,
	fullUrl,
	uploadCDNAsset,
	nascError,
	sendConfirmationEmail,
	sendEmailConfirmedEmail,
	sendForgotPasswordEmail
};