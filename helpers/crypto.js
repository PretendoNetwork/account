const crypto = require('crypto');
const randtoken = require('rand-token');

const fs = require('fs');
const config = require(`${__dirname}/../config`);
const passphrase = config.rsa.privateKeyEncoding.passphrase;
const privateKey = fs.readFileSync(`${__dirname}/../keys/token/private.pem`);
const publicKey = fs.readFileSync(`${__dirname}/../keys/token/public.pem`);
const serviceTokenMagic = Buffer.from('PRND');

function signServiceToken(pid) {
	const expireBuffer = Buffer.alloc(4);
	const pidBuffer = Buffer.alloc(4);

	const expireTime = Math.floor((Date.now() / 1000) + 3600); // Only valid for an hour

	expireBuffer.writeUInt32LE(expireTime);
	pidBuffer.writeUInt32LE(pid);

	const serviceTokenBuffer = Buffer.concat([
		serviceTokenMagic,
		expireBuffer,
		pidBuffer
	]);

	const signed = crypto.publicEncrypt(publicKey, serviceTokenBuffer).toString('base64');
	
	return signed;
}

function unpackServiceToken(token) {
	let decrypted = crypto.privateDecrypt({
		key: privateKey,
		passphrase
	}, token);

	if (!decrypted || decrypted.length !== 12 || !decrypted.subarray(0, 4).equals(serviceTokenMagic)) {
		return null;
	}

	decrypted = decrypted.subarray(4);
	const expireTime = decrypted.readUInt32LE();
	const pid = decrypted.readUInt32LE(4);


	if (!pid || !expireTime || Math.floor(Date.now()/1000) > expireTime) {
		return null;
	}

	const data = {
		expire_time: expireTime,
		pid
	};

	return data;
}

function generateAccessToken(pid) {
	const payload = {
		pid,
		type: 'access',
		salt: randtoken.generate(10)
	};

	const token = crypto.createHash('md5').update(JSON.stringify(payload)).digest('hex');

	return token;
}

function generateRefreshToken(pid) {
	const payload = {
		pid,
		type: 'refresh',
		salt: randtoken.generate(10)
	};
	
	const token = crypto.createHash('md5').update(JSON.stringify(payload)).digest('hex');

	return token;
}

function nintendoPasswordHash(password, pid) {
	const pidBuffer = Buffer.alloc(4);
	pidBuffer.writeUInt32LE(pid);

	const unpacked = Buffer.concat([
		pidBuffer,
		Buffer.from('\x02eCF'),
		Buffer.from(password)
	]);
	const hashed = crypto.createHash('sha256').update(unpacked).digest().toString('hex');

	return hashed;
}

module.exports = {
	generateAccessToken,
	generateRefreshToken,
	signServiceToken,
	unpackServiceToken,
	nintendoPasswordHash
};