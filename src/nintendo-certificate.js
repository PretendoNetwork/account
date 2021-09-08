// Parse Nintendo certificates

const crypto = require('crypto');
const NodeRSA = require('node-rsa');

const WIIU_DEVICE_PUB_PEM = `-----BEGIN PUBLIC KEY-----
MFIwEAYHKoZIzj0CAQYFK4EEABsDPgAEAP1WBBgs8XUJIQDDCK5IOZEbb5+h1TqV
rwgzSUcrAAFxMWm1kf/TDL9z2nZkuo0N+VtNEQREZDXA7aQv
-----END PUBLIC KEY-----`;

const CTR_DEVICE_PUB_PEM = `-----BEGIN PUBLIC KEY-----
MFIwEAYHKoZIzj0CAQYFK4EEABsDPgAEAE47t01dlZ5ozpAENP6eSj8JSjN3H6fA
5LAjJk2YAUyh/HmdP6UhcdX5vVsXd+wP73o40Wabv4MDJYQ6
-----END PUBLIC KEY-----`;

// Signature options
const SIGNATURE_SIZES = {
	RSA_4096_SHA1: {
		SIZE: 0x200,
		PADDING_SIZE: 0x3C
	},
	RSA_2048_SHA1: {
		SIZE: 0x100,
		PADDING_SIZE: 0x3C
	},
	ELLIPTIC_CURVE_SHA1: {
		SIZE: 0x3C,
		PADDING_SIZE: 0x40
	},
	RSA_4096_SHA256: {
		SIZE: 0x200,
		PADDING_SIZE: 0x3C
	},
	RSA_2048_SHA256: {
		SIZE: 0x100,
		PADDING_SIZE: 0x3C
	},
	ECDSA_SHA256: {
		SIZE: 0x3C,
		PADDING_SIZE: 0x40
	}
};

class NintendoCertificate {
	constructor(certificate) {
		this._certificate = null;
		this._certificateBody = null;
		this.signatureType = null;
		this.signature = null;
		this.issuer = null;
		this.keyType = null;
		this.certificateName = null;
		this.ngKeyId = null;
		this.publicKey = null;
		this.valid = null;

		if (certificate) {
			if (certificate instanceof Buffer) {
				this._certificate = certificate;
			} else {
				this._certificate = Buffer.from(certificate, 'base64');
			}

			this._parseCertificateData();
			this._verifySignature();
		}
	}

	_parseCertificateData() {
		this.signatureType = this._certificate.readUInt32BE(0x00);

		const signatureTypeSizes = this._signatureTypeSizes(this.signatureType);

		this._certificateBody = this._certificate.subarray(0x4 + signatureTypeSizes.SIZE + signatureTypeSizes.PADDING_SIZE);

		this.signature = this._certificate.subarray(0x4, 0x4 + signatureTypeSizes.SIZE);
		this.issuer = this._certificate.subarray(0x80, 0xC0).toString().split('\0')[0];
		this.keyType = this._certificate.readUInt32BE(0xC0);
		this.certificateName = this._certificate.subarray(0xC4, 0x104).toString().split('\0')[0];
		this.ngKeyId = this._certificate.readUInt32BE(0x104);
		this.publicKeyData = this._certificate.subarray(0x108);
	}

	_signatureTypeSizes(signatureType) {
		switch (signatureType) {
			case 0x10000:
				return SIGNATURE_SIZES.RSA_4096_SHA1;
			case 0x10001:
				return SIGNATURE_SIZES.RSA_2048_SHA1;
			case 0x10002:
				return SIGNATURE_SIZES.ELLIPTIC_CURVE_SHA1;
			case 0x10003:
				return SIGNATURE_SIZES.RSA_4096_SHA256;
			case 0x10004:
				return SIGNATURE_SIZES.RSA_2048_SHA256;
			case 0x10005:
				return SIGNATURE_SIZES.ECDSA_SHA256;
			default:
				throw new Error(`Unknown signature type 0x${signatureType.toString(16)}`);
		}
	}

	_verifySignature() {
		switch (this.keyType) {
			case 0x0:
				this._verifySignatureRSA4096();
				break;

			case 0x1:
				this._verifySignatureRSA2048();
				break;

			case 0x2:
				this._verifySignatureECDSA();
				break;

			default:
				break;
		}
	}

	_verifySignatureRSA4096() {
		const publicKey = new NodeRSA();

		publicKey.importKey({
			n: this.publicKeyData.subarray(0x0, 0x200),
			e: this.publicKeyData.subarray(0x200, 0x204)
		}, 'components-public');

		this.valid = publicKey.verify(this._certificateBody, this.signature);
	}

	_verifySignatureRSA2048() {
		const publicKey = new NodeRSA();

		publicKey.importKey({
			n: this.publicKeyData.subarray(0x0, 0x100),
			e: this.publicKeyData.subarray(0x100, 0x104)
		}, 'components-public');

		this.valid = publicKey.verify(this._certificateBody, this.signature);
	}

	// Huge thanks to Myria for helping get ECDSA working
	// with Nodes native crypto module and getting the keys
	// from bytes to PEM!
	// https://github.com/Myriachan
	_verifySignatureECDSA() {
		const pem = this.issuer == 'Root-CA00000003-MS00000012' ? WIIU_DEVICE_PUB_PEM : CTR_DEVICE_PUB_PEM;
		const key = crypto.createPublicKey({
			key: pem
		});
		key.dsaEncoding = 'ieee-p1363';

		this.valid = crypto.verify('sha256', this._certificateBody, key, this.signature);
	}
}

module.exports = NintendoCertificate;