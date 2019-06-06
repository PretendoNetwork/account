const { generateKeyPair } = require('crypto');
const fs = require('fs-extra');
const {rsa: rsaOptions} = require('./config');

fs.ensureDirSync(`${__dirname}/keys/token`);

generateKeyPair('rsa', rsaOptions, (error, publicKey, privateKey) => {
	fs.writeFileSync(`${__dirname}/keys/token/public.pem`, publicKey);
	fs.writeFileSync(`${__dirname}/keys/token/private.pem`, privateKey);
});