import crypto from 'node:crypto';
import path from 'node:path';
import { S3 } from '@aws-sdk/client-s3';
import fs from 'fs-extra';
import { sendMail, CreateEmail } from '@/mailer';
import { SystemType } from '@/types/common/system-types';
import { TokenType } from '@/types/common/token-types';
import { config, disabledFeatures } from '@/config-manager';
import { PasswordResetToken } from '@/models/password-reset-token';
import type { ParsedQs } from 'qs';
import type mongoose from 'mongoose';
import type express from 'express';
import type { ObjectCannedACL } from '@aws-sdk/client-s3';
import type { IncomingHttpHeaders } from 'node:http';
import type { IPNID, IPNIDMethods } from '@/types/mongoose/pnid';
import type { SafeQs } from '@/types/common/safe-qs';
import type { HydratedServerDocument } from '@/types/mongoose/server';
import type { ServiceTokenOptions } from '@/types/common/service-token-options';

let s3: S3;

if (!disabledFeatures.s3) {
	s3 = new S3({
		endpoint: config.s3.endpoint,
		forcePathStyle: config.s3.forcePathStyle,
		region: config.s3.region,

		credentials: {
			accessKeyId: config.s3.key,
			secretAccessKey: config.s3.secret
		}
	});
}

export function nintendoPasswordHash(password: string, pid: number): string {
	const pidBuffer = Buffer.alloc(4);
	pidBuffer.writeUInt32LE(pid);

	const unpacked = Buffer.concat([
		pidBuffer,
		Buffer.from('\x02\x65\x43\x46'),
		Buffer.from(password)
	]);

	return crypto.createHash('sha256').update(unpacked).digest().toString('hex');
}

export function nintendoBase64Decode(encoded: string): Buffer {
	encoded = encoded.replaceAll('.', '+').replaceAll('-', '/').replaceAll('*', '=');
	return Buffer.from(encoded, 'base64');
}

export function nintendoBase64Encode(decoded: string | Buffer): string {
	const encoded = Buffer.from(decoded).toString('base64');
	return encoded.replaceAll('+', '.').replaceAll('/', '-').replaceAll('=', '*');
}

export function createServiceToken(server: HydratedServerDocument, options: ServiceTokenOptions): Buffer {
	const dataBuffer = Buffer.alloc(28);

	dataBuffer.writeUInt32BE(options.pid, 0);
	dataBuffer.writeBigUInt64BE(BigInt(parseInt(options.title_id, 16)), 4);
	dataBuffer.writeBigUInt64BE(BigInt(options.issued.getTime()), 12);
	dataBuffer.writeBigUInt64BE(BigInt(options.expires.getTime()), 20);

	// * Not using AES anymore but fuck it, it's here already
	// TODO - rename the AES field
	const hmac = crypto.createHmac('sha256', server.aes_key).update(dataBuffer).digest();

	return Buffer.concat([
		dataBuffer,
		hmac
	]);
}

export function fullUrl(request: express.Request): string {
	const protocol = request.protocol;
	const host = request.host;
	const opath = request.originalUrl;

	return `${protocol}://${host}${opath}`;
}

export async function uploadCDNAsset(bucket: string, key: string, data: Buffer, acl: ObjectCannedACL): Promise<void> {
	if (disabledFeatures.s3) {
		await writeLocalCDNFile(key, data);
	} else {
		await s3.putObject({
			Body: data,
			Key: key,
			Bucket: bucket,
			ACL: acl
		});
	}
}

export async function writeLocalCDNFile(key: string, data: Buffer): Promise<void> {
	const filePath = config.cdn.disk_path;
	const folder = path.dirname(filePath);

	await fs.ensureDir(folder);
	await fs.writeFile(filePath, data);
}

export function nascDateTime(): string {
	const now = new Date();

	const year = now.getFullYear();
	const month = (now.getMonth() + 1).toString().padStart(2, '0'); // * Months are zero-based
	const day = now.getDate().toString().padStart(2, '0');
	const hours = now.getHours().toString().padStart(2, '0');
	const minutes = now.getMinutes().toString().padStart(2, '0');
	const seconds = now.getSeconds().toString().padStart(2, '0');

	return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

export function nascError(errorCode: string): URLSearchParams {
	return new URLSearchParams({
		retry: nintendoBase64Encode('1'),
		returncd: errorCode == 'null' ? errorCode : nintendoBase64Encode(errorCode),
		datetime: nintendoBase64Encode(nascDateTime())
	});
}

export async function sendConfirmationEmail(pnid: mongoose.HydratedDocument<IPNID, IPNIDMethods>): Promise<void> {
	const email = new CreateEmail()
		.addHeader('Hello {{pnid}}!', { pnid: pnid.username })
		.addParagraph('Your <b>Pretendo Network ID</b> activation is almost complete. Please click the link below to confirm your e-mail address and complete the activation process.')
		.addButton('Confirm email address', `https://api.pretendo.cc/v1/email/verify?token=${pnid.identification.email_token}`)
		.addParagraph('You may also enter the following 6-digit code on your console:')
		.addButton(pnid.identification.email_code, '', false)
		.addParagraph('We hope you have fun using our services!');

	const options = {
		to: pnid.email.address,
		subject: '[Pretendo Network] Please confirm your email address',
		email
	};

	await sendMail(options);
}

export async function sendEmailConfirmedEmail(pnid: mongoose.HydratedDocument<IPNID, IPNIDMethods>): Promise<void> {
	const email = new CreateEmail()
		.addHeader('Dear {{pnid}}!', { pnid: pnid.username })
		.addParagraph('Your email address has been confirmed.')
		.addParagraph('We hope you have fun on Pretendo Network!');

	const options = {
		to: pnid.email.address,
		subject: '[Pretendo Network] Email address confirmed',
		email
	};

	await sendMail(options);
}

export async function sendEmailConfirmedParentalControlsEmail(pnid: mongoose.HydratedDocument<IPNID, IPNIDMethods>): Promise<void> {
	const email = new CreateEmail()
		.addHeader('Dear {{pnid}},', { pnid: pnid.username })
		.addParagraph('your email address has been confirmed for use with Parental Controls.');

	const options = {
		to: pnid.email.address,
		subject: '[Pretendo Network] Email address confirmed for Parental Controls',
		email
	};

	await sendMail(options);
}

export async function sendForgotPasswordEmail(pnid: mongoose.HydratedDocument<IPNID, IPNIDMethods>): Promise<void> {
	const token = crypto.randomBytes(36).toString('hex');

	await PasswordResetToken.create({
		token: crypto.createHash('sha256').update(token).digest('hex'),
		pid: pnid.pid,
		info: {
			system_type: SystemType.PasswordReset,
			token_type: TokenType.PasswordReset,
			title_id: BigInt(0),
			issued: new Date(),
			expires: new Date(Date.now() + (24 * 60 * 60 * 1000))
		}
	});

	const email = new CreateEmail()
		.addHeader('Dear {{pnid}},', { pnid: pnid.username })
		.addParagraph('a password reset has been requested from this account.')
		.addParagraph('If you did not request the password reset, please ignore this email. If you did request this password reset, please click the link below to reset your password.')
		.addButton('Reset password', `${config.website_base}/account/reset-password?token=${encodeURIComponent(token)}`);

	const mailerOptions = {
		to: pnid.email.address,
		subject: '[Pretendo Network] Forgot Password',
		email
	};

	await sendMail(mailerOptions);
}

export async function sendPNIDDeletedEmail(emailAddress: string, username: string): Promise<void> {
	const email = new CreateEmail()
		.addHeader('Dear {{pnid}},', { pnid: username })
		.addParagraph('your PNID has successfully been deleted.')
		.addParagraph('If you had a tier subscription, a separate cancellation email will be sent. If you do not receive this cancellation email, or you are still being charged for your subscription, please contact <b>@jonbarrow</b> on our [Discord server](https://discord.pretendo.network/).');

	const options = {
		to: emailAddress,
		subject: '[Pretendo Network] PNID Deleted',
		email
	};

	await sendMail(options);
}

export function makeSafeQs(query: ParsedQs): SafeQs {
	const entries = Object.entries(query);
	const output: SafeQs = {};

	for (const [key, value] of entries) {
		if (typeof value !== 'string') {
			// * ignore non-strings
			continue;
		}

		output[key] = value;
	}

	return output;
}

export function getValueFromQueryString(qs: ParsedQs, key: string): string | undefined {
	let property = qs[key];
	let value;

	if (property) {
		if (Array.isArray(property)) {
			property = property[0];
		}

		if (typeof property !== 'string') {
			property = makeSafeQs(<ParsedQs>property);
			value = (<SafeQs>property)[key];
		} else {
			value = <string>property;
		}
	}

	return value;
}

export function getValueFromHeaders(headers: IncomingHttpHeaders, key: string): string | undefined {
	let header = headers[key];
	let value;

	if (header) {
		if (!Array.isArray(header)) {
			header = header.split(', ');
		}

		value = header[0];
	}

	return value;
}

export function mapToObject(map: Map<any, any>): object {
	return Object.fromEntries(Array.from(map.entries(), ([k, v]) => v instanceof Map ? [k, mapToObject(v)] : [k, v]));
}

export function isValidBirthday(dateString: string): boolean {
	// * Birthdays MUST be in the format YYYY-MM-DD. This is how the
	// * console sends them, regardless of region

	// * Make sure general format is right
	const regex = /^\d{4}-\d{2}-\d{2}$/;
	if (!regex.test(dateString)) {
		return false;
	}

	// * Actually check that it's a valid date
	const parts = dateString.split('-');
	const year = parseInt(parts[0], 10);
	const month = parseInt(parts[1], 10);
	const day = parseInt(parts[2], 10);

	const date = new Date(year, month - 1, day);

	return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function getAgeFromDate(dateString: string): number {
	if (!isValidBirthday(dateString)) {
		return -1;
	}

	const parts = dateString.split('-');
	const birthYear = parseInt(parts[0], 10);
	const birthMonth = parseInt(parts[1], 10);
	const birthDay = parseInt(parts[2], 10);

	const today = new Date();
	const currentYear = today.getFullYear();
	const currentMonth = today.getMonth() + 1;
	const currentDay = today.getDate();

	let age = currentYear - birthYear;

	// * Check if birthday has actually happened this year yet
	if (currentMonth < birthMonth || (currentMonth === birthMonth && currentDay < birthDay)) {
		age--;
	}

	return age;
}
