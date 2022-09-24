const crypto = require('crypto');
const router = require('express').Router();
const Dicer = require('dicer');
const fs = require('fs');
const util = require('../../../util');

const signatureSecret = fs.readFileSync(`${__dirname}/../../../../certs/nex/datastore/secret.key`);

function multipartParser(request, response, next) {
	const RE_BOUNDARY = /^multipart\/.+?(?:; boundary=(?:(?:"(.+)")|(?:([^\s]+))))$/i;
	const RE_FILE_NAME = /name="(.*)"/;
	const boundary = RE_BOUNDARY.exec(request.header('content-type'));
	const dicer = new Dicer({ boundary: boundary[1] || boundary[2] });
	const files = {};

	dicer.on('part', part => {
		let fileBuffer = Buffer.alloc(0);
		let fileName = '';

		part.on('header', header => {
			fileName = RE_FILE_NAME.exec(header['content-disposition'][0])[1];
		});

		part.on('data', data => {
			fileBuffer = Buffer.concat([fileBuffer, data]);
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

router.post('/upload', multipartParser, async (request, response) => {
	const {
		bucket,    // Space name
		key,       // path
		file,      // the file content
		acl,       // S3 ACL
		pid,       // uploading user PID
		date,      // upload time
		signature, // data signature
	} = request.files;

	// Signatures only good for 1 minute
	const minute = 1000 * 60;
	const minuteAgo = Date.now() - minute;

	if (Number(date) < Math.floor(minuteAgo / 1000)) {
		return response.sendStatus(400);
	}

	const data = pid.toString() + bucket.toString() + key.toString() + date.toString();

	const hmac = crypto.createHmac('sha256', signatureSecret).update(data).digest('hex');

	console.log(hmac, signature.toString());

	if (hmac !== signature.toString()) {
		return response.sendStatus(400);
	}
	
	await util.uploadCDNAsset(bucket.toString(), key.toString(), file, acl.toString());
	response.sendStatus(200);
});

module.exports = router;