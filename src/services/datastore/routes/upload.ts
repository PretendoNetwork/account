import fs from 'node:fs';
import crypto from 'node:crypto';
import express from 'express';
import Dicer from 'dicer';
import { uploadCDNAsset } from '@/util';

const router: express.Router = express.Router();

const signatureSecret: Buffer = fs.readFileSync(`${__dirname}/../../../../certs/nex/datastore/secret.key`);

function multipartParser(request: express.Request, response: express.Response, next: express.NextFunction) {
	const RE_BOUNDARY: RegExp = /^multipart\/.+?(?:; boundary=(?:(?:"(.+)")|(?:([^\s]+))))$/i;
	const RE_FILE_NAME: RegExp = /name="(.*)"/;

	const boundary: RegExpExecArray = RE_BOUNDARY.exec(request.header('content-type'));
	const dicer: Dicer = new Dicer({ boundary: boundary[1] || boundary[2] });
	const files: { [key: string]: Buffer } = {};

	dicer.on('part', (part: Dicer.PartStream) => {
		let fileBuffer: Buffer = Buffer.alloc(0);
		let fileName: string = '';

		part.on('header', header => {
			fileName = RE_FILE_NAME.exec(header['content-disposition'][0])[1];
		});

		part.on('data', (data: Buffer | string) => {
			if (data instanceof String) {
				data = Buffer.from(data);
			}

			fileBuffer = Buffer.concat([fileBuffer, data as Buffer]);
		});

		part.on('end', () => {
			files[fileName] = fileBuffer;
		});
	});

	dicer.on('finish', function () {
		request.files = files;
		return next();
	});

	request.pipe(dicer);
}

router.post('/upload', multipartParser, async (request: express.Request, response: express.Response) => {
	const bucket: string = request.files.bucket.toString();
	const key: string = request.files.key.toString();
	const file: Buffer = request.files.file;
	const acl: string = request.files.acl.toString();
	const pid: string = request.files.pid.toString();
	const date: string = request.files.date.toString();
	const signature: string = request.files.signature.toString();

	// Signatures only good for 1 minute
	const minute: number = 1000 * 60;
	const minuteAgo: number = Date.now() - minute;

	if (Number(date) < Math.floor(minuteAgo / 1000)) {
		return response.sendStatus(400);
	}

	const data: string = `${pid}${bucket}${key}${date}`;

	const hmac: string = crypto.createHmac('sha256', signatureSecret).update(data).digest('hex');

	console.log(hmac, signature);

	if (hmac !== signature) {
		return response.sendStatus(400);
	}

	await uploadCDNAsset(bucket, key, file, acl);
	response.sendStatus(200);
});

export default router;