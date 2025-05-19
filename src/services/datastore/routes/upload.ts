import crypto from 'node:crypto';
import express from 'express';
import Dicer from 'dicer';
import { uploadCDNAsset } from '@/util';
import { config } from '@/config-manager';

const router = express.Router();

function multipartParser(request: express.Request, response: express.Response, next: express.NextFunction): void {
	const RE_BOUNDARY = /^multipart\/.+?(?:; boundary=(?:(?:"(.+)")|(?:([^\s]+))))$/i;
	const RE_FILE_NAME = /name="(.*)"/;

	const contentType = request.header('content-type');

	if (!contentType) {
		return next();
	}

	const boundary = RE_BOUNDARY.exec(contentType);

	if (!boundary) {
		return next();
	}

	const dicer = new Dicer({ boundary: boundary[1] || boundary[2] });
	const files: Record<string, Buffer> = {};

	dicer.on('part', (part: Dicer.PartStream) => {
		let fileBuffer = Buffer.alloc(0);
		let fileName = '';

		part.on('header', (header) => {
			const contentDisposition = header['content-disposition' as keyof object];
			const regexResult = RE_FILE_NAME.exec(contentDisposition);

			if (regexResult) {
				fileName = regexResult[0];
			}
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

router.post('/upload', multipartParser, async (request: express.Request, response: express.Response): Promise<void> => {
	if (!request.files) {
		response.sendStatus(500);
		return;
	}

	const bucket = request.files.bucket.toString();
	const key = request.files.key.toString();
	const file = request.files.file;
	const acl = request.files.acl.toString();
	const pid = request.files.pid.toString();
	const date = request.files.date.toString();
	const signature = request.files.signature.toString();

	// * Signatures only good for 1 minute
	const minute = 1000 * 60;
	const minuteAgo = Date.now() - minute;

	if (Number(date) < Math.floor(minuteAgo / 1000)) {
		response.sendStatus(400);
		return;
	}

	const data = `${pid}${bucket}${key}${date}`;

	const hmac = crypto.createHmac('sha256', config.datastore.signature_secret).update(data).digest('hex');

	console.log(hmac, signature);

	if (hmac !== signature) {
		response.sendStatus(400);
		return;
	}

	await uploadCDNAsset(bucket, key, file, acl);
	response.sendStatus(200);
});

export default router;
