import crypto from 'node:crypto';
import path from 'node:path';
import NodeRSA from 'node-rsa';
import aws from 'aws-sdk';
import fs from 'fs-extra';
import express from 'express';
import mongoose from 'mongoose';
import mailer from '@/mailer';
import cache from '@/cache';
import { config, disabledFeatures } from '@/config-manager';
import { CryptoOptions } from '@/types/common/crypto-options';
import { TokenOptions } from '@/types/common/token-options';
import { Token } from '@/types/common/token';
import { IPNID, IPNIDMethods } from '@/types/mongoose/pnid';
import { MailerOptions } from '@/types/common/mailer-options';

let s3: aws.S3;

if (!disabledFeatures.s3) {
	s3 = new aws.S3({
		endpoint: new aws.Endpoint(config.s3.endpoint),
		accessKeyId: config.s3.key,
		secretAccessKey: config.s3.secret
	});
}

function nintendoPasswordHash(password: string, pid: number): string {
	const pidBuffer: Buffer = Buffer.alloc(4);
	pidBuffer.writeUInt32LE(pid);

	const unpacked: Buffer = Buffer.concat([
		pidBuffer,
		Buffer.from('\x02\x65\x43\x46'),
		Buffer.from(password)
	]);

	return crypto.createHash('sha256').update(unpacked).digest().toString('hex');
}

function nintendoBase64Decode(encoded: string): Buffer {
	encoded = encoded.replaceAll('.', '+').replaceAll('-', '/').replaceAll('*', '=');
	return Buffer.from(encoded, 'base64');
}

function nintendoBase64Encode(decoded: string | Buffer): string {
	const encoded: string = Buffer.from(decoded).toString('base64');
	return encoded.replaceAll('+', '.').replaceAll('/', '-').replaceAll('=', '*');
}

async function generateToken(cryptoOptions: CryptoOptions | null, tokenOptions: TokenOptions): Promise<string> {
	// Access and refresh tokens use a different format since they must be much smaller
	// They take no extra crypto options
	if (!cryptoOptions) {
		const aesKey: Buffer = await cache.getServiceAESKey('account', 'hex');

		const dataBuffer: Buffer = Buffer.alloc(1 + 1 + 4 + 8);

		dataBuffer.writeUInt8(tokenOptions.system_type, 0x0);
		dataBuffer.writeUInt8(tokenOptions.token_type, 0x1);
		dataBuffer.writeUInt32LE(tokenOptions.pid, 0x2);
		dataBuffer.writeBigUInt64LE(tokenOptions.expire_time, 0x6);

		const iv: Buffer = Buffer.alloc(16);
		const cipher: crypto.Cipher = crypto.createCipheriv('aes-128-cbc', aesKey, iv);

		let encryptedBody: Buffer = cipher.update(dataBuffer);
		encryptedBody = Buffer.concat([encryptedBody, cipher.final()]);

		return encryptedBody.toString('base64');
	}

	const publicKey: NodeRSA = new NodeRSA(cryptoOptions.public_key, 'pkcs8-public-pem', {
		environment: 'browser',
		encryptionScheme: {
			scheme: 'pkcs1_oaep',
			hash: 'sha256'
		}
	});

	// Create the buffer containing the token data
	const dataBuffer: Buffer = Buffer.alloc(1 + 1 + 4 + 1 + 8 + 8);

	dataBuffer.writeUInt8(tokenOptions.system_type, 0x0);
	dataBuffer.writeUInt8(tokenOptions.token_type, 0x1);
	dataBuffer.writeUInt32LE(tokenOptions.pid, 0x2);
	dataBuffer.writeUInt8(tokenOptions.access_level, 0x6);
	dataBuffer.writeBigUInt64LE(tokenOptions.title_id, 0x7);
	dataBuffer.writeBigUInt64LE(tokenOptions.expire_time, 0xF);

	// Calculate the signature of the token body
	const hmac: crypto.Hmac = crypto.createHmac('sha1', cryptoOptions.hmac_secret).update(dataBuffer);
	const signature: Buffer = hmac.digest();

	// You can thank the 3DS for the shit thats about to happen with the AES IV
	// The 3DS only allows for strings up to 255 characters in NEX
	// So this is done to reduce the token size as much as possible
	// I am sorry, and have already asked every God I could think of for forgiveness

	// Generate random AES key
	const key: Buffer = crypto.randomBytes(16);

	// Encrypt the AES key with RSA public key
	const encryptedKey: Buffer = publicKey.encrypt(key);

	// Take two random points in the RSA encrypted key
	const point1: number = ~~((encryptedKey.length - 8) * Math.random());
	const point2: number = ~~((encryptedKey.length - 8) * Math.random());

	// Build an IV from each of the two points
	const iv: Buffer = Buffer.concat([
		Buffer.from(encryptedKey.subarray(point1, point1 + 8)),
		Buffer.from(encryptedKey.subarray(point2, point2 + 8))
	]);

	const cipher: crypto.Cipher = crypto.createCipheriv('aes-128-cbc', key, iv);

	// Encrypt the token body with AES
	const encryptedBody: Buffer = Buffer.concat([
		cipher.update(dataBuffer),
		cipher.final()
	]);

	// Create crypto config token section
	const cryptoConfig: Buffer = Buffer.concat([
		encryptedKey,
		Buffer.from([point1, point2])
	]);

	// Build the token
	const token: Buffer = Buffer.concat([
		cryptoConfig,
		signature,
		encryptedBody
	]);

	return token.toString('base64'); // Encode to base64 for transport
}

async function decryptToken(token: Buffer): Promise<Buffer> {
	// Access and refresh tokens use a different format since they must be much smaller
	// Assume a small length means access or refresh token
	if (token.length <= 32) {
		const aesKey: Buffer = await cache.getServiceAESKey('account', 'hex');

		const iv: Buffer = Buffer.alloc(16);

		const decipher: crypto.Decipher = crypto.createDecipheriv('aes-128-cbc', aesKey, iv);

		const decryptedBody: Buffer = Buffer.concat([
			decipher.update(token),
			decipher.final()
		]);

		return decryptedBody;
	}

	const privateKeyBytes: Buffer = await cache.getServicePrivateKey('account');
	const secretKey: Buffer = await cache.getServiceSecretKey('account');

	const privateKey: NodeRSA = new NodeRSA(privateKeyBytes, 'pkcs1-private-pem', {
		environment: 'browser',
		encryptionScheme: {
			scheme: 'pkcs1_oaep',
			hash: 'sha256'
		}
	});

	const cryptoConfig: Buffer = token.subarray(0, 0x82);
	const signature: Buffer = token.subarray(0x82, 0x96);
	const encryptedBody: Buffer = token.subarray(0x96);

	const encryptedAESKey: Buffer = cryptoConfig.subarray(0, 128);
	const point1: number = cryptoConfig.readInt8(0x80);
	const point2: number = cryptoConfig.readInt8(0x81);

	const iv: Buffer = Buffer.concat([
		Buffer.from(encryptedAESKey.subarray(point1, point1 + 8)),
		Buffer.from(encryptedAESKey.subarray(point2, point2 + 8))
	]);

	const decryptedAESKey: Buffer = privateKey.decrypt(encryptedAESKey);

	const decipher: crypto.Decipher = crypto.createDecipheriv('aes-128-cbc', decryptedAESKey, iv);

	const decryptedBody: Buffer = Buffer.concat([
		decipher.update(encryptedBody),
		decipher.final()
	]);

	const hmac: crypto.Hmac = crypto.createHmac('sha1', secretKey).update(decryptedBody);
	const calculatedSignature: Buffer = hmac.digest();

	if (!signature.equals(calculatedSignature)) {
		console.log('Token signature did not match');
		return null;
	}

	return decryptedBody;
}

function unpackToken(token: Buffer): Token {
	if (token.length <= 14) {
		return <Token>{
			system_type: token.readUInt8(0x0),
			token_type: token.readUInt8(0x1),
			pid: token.readUInt32LE(0x2),
			expire_time: token.readBigUInt64LE(0x6)
		};
	}

	return <Token>{
		system_type: token.readUInt8(0x0),
		token_type: token.readUInt8(0x1),
		pid: token.readUInt32LE(0x2),
		access_level: token.readUInt8(0x6),
		title_id: token.readBigUInt64LE(0x7),
		expire_time: token.readBigUInt64LE(0xF)
	};
}

function fullUrl(request: express.Request): string {
	const protocol: string = request.protocol;
	const host: string = request.host;
	const opath: string = request.originalUrl;

	return `${protocol}://${host}${opath}`;
}

async function uploadCDNAsset(bucket: string, key: string, data: Buffer, acl: string): Promise<void> {
	if (disabledFeatures.s3) {
		await writeLocalCDNFile(key, data);
	} else {
		await s3.putObject({
			Body: data,
			Key: key,
			Bucket: bucket,
			ACL: acl
		}).promise();
	}
}

async function writeLocalCDNFile(key: string, data: Buffer): Promise<void> {
	const filePath: string = config.cdn.disk_path;
	const folder: string = path.dirname(filePath);

	await fs.ensureDir(folder);
	await fs.writeFile(filePath, data);
}

function nascError(errorCode: string): URLSearchParams {
	return new URLSearchParams({
		retry: nintendoBase64Encode('1'),
		returncd: errorCode == 'null' ? errorCode : nintendoBase64Encode(errorCode),
		datetime: nintendoBase64Encode(Date.now().toString()),
	});
}

async function sendConfirmationEmail(pnid: mongoose.HydratedDocument<IPNID, IPNIDMethods>): Promise<void> {
	const options: MailerOptions = {
		to: pnid.email.address,
		subject: '[Pretendo Network] Please confirm your email address',
		username: pnid.username,
		confirmation: {
			href: `https://api.pretendo.cc/v1/email/verify?token=${pnid.identification.email_token}`,
			code: pnid.identification.email_code
		},
		text: `Hello ${pnid.username}! \r\n\r\nYour Pretendo Network ID activation is almost complete. Please click the link to confirm your e-mail address and complete the activation process: \r\nhttps://api.pretendo.cc/v1/email/verify?token=${pnid.identification.email_token} \r\n\r\nYou may also enter the following 6-digit code on your console: ${pnid.identification.email_code}`
	};

	await mailer.sendMail(options);
}

async function sendEmailConfirmedEmail(pnid: mongoose.HydratedDocument<IPNID, IPNIDMethods>): Promise<void>  {
	const options: MailerOptions = {
		to: pnid.email.address,
		subject: '[Pretendo Network] Email address confirmed',
		username: pnid.username,
		paragraph: 'your email address has been confirmed. We hope you have fun on Pretendo Network!',
		text: `Dear ${pnid.username}, \r\n\r\nYour email address has been confirmed. We hope you have fun on Pretendo Network!`
	};

	await mailer.sendMail(options);
}

async function sendForgotPasswordEmail(pnid: mongoose.HydratedDocument<IPNID, IPNIDMethods>): Promise<void> {
	const publicKey: Buffer = await cache.getServicePublicKey('account');
	const secretKey: Buffer = await cache.getServiceSecretKey('account');

	const cryptoOptions: CryptoOptions = {
		public_key: publicKey,
		hmac_secret: secretKey
	};

	const tokenOptions: TokenOptions = {
		system_type: 0xF, // API
		token_type: 0x5, // Password reset
		pid: pnid.pid,
		access_level: pnid.access_level,
		title_id: BigInt(0),
		expire_time: BigInt(Date.now() + (24 * 60 * 60 * 1000)) // Only valid for 24 hours
	};

	const passwordResetToken: string = await generateToken(cryptoOptions, tokenOptions);

	const mailerOptions: MailerOptions = {
		to: pnid.email.address,
		subject: '[Pretendo Network] Forgot Password',
		username: pnid.username,
		paragraph: 'a password reset has been requested from this account. If you did not request the password reset, please ignore this email. If you did request this password reset, please click the link below to reset your password.',
		link: {
			text: 'Reset password',
			href: `${config.website_base}/account/reset-password?token=${encodeURIComponent(passwordResetToken)}`
		},
		text: `Dear ${pnid.username}, a password reset has been requested from this account. \r\n\r\nIf you did not request the password reset, please ignore this email. \r\nIf you did request this password reset, please click the link to reset your password: ${config.website_base}/account/reset-password?token=${encodeURIComponent(passwordResetToken)}`
	};

	await mailer.sendMail(mailerOptions);
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