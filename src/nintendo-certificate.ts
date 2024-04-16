import crypto from 'node:crypto';
import NodeRSA from 'node-rsa';
import { SignatureSize } from '@/types/common/signature-size';

const WIIU_DEVICE_PUB_PEM = `-----BEGIN PUBLIC KEY-----
MFIwEAYHKoZIzj0CAQYFK4EEABsDPgAEAP1WBBgs8XUJIQDDCK5IOZEbb5+h1TqV
rwgzSUcrAAFxMWm1kf/TDL9z2nZkuo0N+VtNEQREZDXA7aQv
-----END PUBLIC KEY-----`;

const CTR_DEVICE_PUB_PEM = `-----BEGIN PUBLIC KEY-----
MFIwEAYHKoZIzj0CAQYFK4EEABsDPgAEAE47t01dlZ5ozpAENP6eSj8JSjN3H6fA
5LAjJk2YAUyh/HmdP6UhcdX5vVsXd+wP73o40Wabv4MDJYQ6
-----END PUBLIC KEY-----`;

const CTR_LFCS_B_PUB = Buffer.from([
	0x00, 0xA3, 0x75, 0x9A, 0x35, 0x46, 0xCF, 0xA7, 0xFE, 0x30,
	0xEC, 0x55, 0xA1, 0xB6, 0x4E, 0x08, 0xE9, 0x44, 0x9D, 0x0C,
	0x72, 0xFC, 0xD1, 0x91, 0xFD, 0x61, 0x0A, 0x28, 0x89, 0x75,
	0xBC, 0xE6, 0xA9, 0xB2, 0x15, 0x56, 0xE9, 0xC7, 0x67, 0x02,
	0x55, 0xAD, 0xFC, 0x3C, 0xEE, 0x5E, 0xDB, 0x78, 0x25, 0x9A,
	0x4B, 0x22, 0x1B, 0x71, 0xE7, 0xE9, 0x51, 0x5B, 0x2A, 0x67,
	0x93, 0xB2, 0x18, 0x68, 0xCE, 0x5E, 0x5E, 0x12, 0xFF, 0xD8,
	0x68, 0x06, 0xAF, 0x31, 0x8D, 0x56, 0xF9, 0x54, 0x99, 0x02,
	0x34, 0x6A, 0x17, 0xE7, 0x83, 0x74, 0x96, 0xA0, 0x5A, 0xAF,
	0x6E, 0xFD, 0xE6, 0xBE, 0xD6, 0x86, 0xAA, 0xFD, 0x7A, 0x65,
	0xA8, 0xEB, 0xE1, 0x1C, 0x98, 0x3A, 0x15, 0xC1, 0x7A, 0xB5,
	0x40, 0xC2, 0x3D, 0x9B, 0x7C, 0xFD, 0xD4, 0x63, 0xC5, 0xE6,
	0xDE, 0xB7, 0x78, 0x24, 0xC6, 0x29, 0x47, 0x33, 0x35, 0xB2,
	0xE9, 0x37, 0xE0, 0x54, 0xEE, 0x9F, 0xA5, 0x3D, 0xD7, 0x93,
	0xCA, 0x3E, 0xAE, 0x4D, 0xB6, 0x0F, 0x5A, 0x11, 0xE7, 0x0C,
	0xDF, 0xBA, 0x03, 0xB2, 0x1E, 0x2B, 0x31, 0xB6, 0x59, 0x06,
	0xDB, 0x5F, 0x94, 0x0B, 0xF7, 0x6E, 0x74, 0xCA, 0xD4, 0xAB,
	0x55, 0xD9, 0x40, 0x05, 0x8F, 0x10, 0xFE, 0x06, 0x05, 0x0C,
	0x81, 0xBB, 0x42, 0x21, 0x90, 0xBA, 0x4F, 0x5C, 0x53, 0x82,
	0xE1, 0xE1, 0x0F, 0xBC, 0x94, 0x9F, 0x60, 0x69, 0x5D, 0x13,
	0x03, 0xAA, 0xE2, 0xE0, 0xC1, 0x08, 0x42, 0x4C, 0x20, 0x0B,
	0x9B, 0xAA, 0x55, 0x2D, 0x55, 0x27, 0x6E, 0x24, 0xE5, 0xD6,
	0x04, 0x57, 0x58, 0x8F, 0xF7, 0x5F, 0x0C, 0xEC, 0x81, 0x9F,
	0x6D, 0x2D, 0x28, 0xF3, 0x10, 0x55, 0xF8, 0x3B, 0x76, 0x62,
	0xD4, 0xE4, 0xA6, 0x93, 0x69, 0xB5, 0xDA, 0x6B, 0x40, 0x23,
	0xAF, 0x07, 0xEB, 0x9C, 0xBF, 0xA9, 0xC9
]);

// * Signature options
const SIGNATURE_SIZES = {
	RSA_4096_SHA1: <SignatureSize>{
		SIZE: 0x200,
		PADDING_SIZE: 0x3C
	},
	RSA_2048_SHA1: <SignatureSize>{
		SIZE: 0x100,
		PADDING_SIZE: 0x3C
	},
	ELLIPTIC_CURVE_SHA1: <SignatureSize>{
		SIZE: 0x3C,
		PADDING_SIZE: 0x40
	},
	RSA_4096_SHA256: <SignatureSize>{
		SIZE: 0x200,
		PADDING_SIZE: 0x3C
	},
	RSA_2048_SHA256: <SignatureSize>{
		SIZE: 0x100,
		PADDING_SIZE: 0x3C
	},
	ECDSA_SHA256: <SignatureSize>{
		SIZE: 0x3C,
		PADDING_SIZE: 0x40
	}
} as const;

class NintendoCertificate {
	_certificate: Buffer;
	_certificateBody: Buffer;
	signatureType: number;
	signature: Buffer;
	issuer: string;
	keyType: number;
	certificateName: string;
	ngKeyID: number;
	publicKey: Buffer;
	valid: boolean;
	publicKeyData: Buffer;
	consoleType: string;

	constructor(certificate: string | Buffer) {
		this._certificate = Buffer.alloc(0);
		this._certificateBody = Buffer.alloc(0);
		this.signatureType = 0;
		this.signature = Buffer.alloc(0);
		this.issuer = '';
		this.keyType = 0;
		this.certificateName = '';
		this.ngKeyID = 0;
		this.publicKey = Buffer.alloc(0);
		this.valid = false;
		this.publicKeyData = Buffer.alloc(0);
		this.consoleType = '';

		if (certificate) {
			if (certificate instanceof Buffer) {
				this._certificate = certificate;
			} else {
				this._certificate = Buffer.from(certificate, 'base64');
			}

			this._parseCertificateData();
		}
	}

	_parseCertificateData(): void {
		if (this._certificate.length === 0x110) {
			// * Assume fcdcert (3DS LFCS)
			this.consoleType = '3ds';
			this.signature = this._certificate.subarray(0x0, 0x100);
			this._certificateBody = this._certificate.subarray(0x100);

			this._verifySignatureLFCS();
		} else {
			// * Assume regular certificate
			this.signatureType = this._certificate.readUInt32BE(0x00);

			const signatureTypeSizes = this._signatureTypeSizes(this.signatureType);

			this._certificateBody = this._certificate.subarray(0x4 + signatureTypeSizes.SIZE + signatureTypeSizes.PADDING_SIZE);

			this.signature = this._certificate.subarray(0x4, 0x4 + signatureTypeSizes.SIZE);
			this.issuer = this._certificate.subarray(0x80, 0xC0).toString().split('\0')[0];
			this.keyType = this._certificate.readUInt32BE(0xC0);
			this.certificateName = this._certificate.subarray(0xC4, 0x104).toString().split('\0')[0];
			this.ngKeyID = this._certificate.readUInt32BE(0x104);
			this.publicKeyData = this._certificate.subarray(0x108);

			if (this.issuer === 'Root-CA00000003-MS00000012') {
				this.consoleType = 'wiiu';
			} else {
				this.consoleType = '3ds';
			}

			this._verifySignature();
		}
	}

	_signatureTypeSizes(signatureType: number): SignatureSize {
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

	_verifySignature(): void {
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

	_verifySignatureRSA4096(): void {
		const publicKey = new NodeRSA();

		publicKey.importKey({
			n: this.publicKeyData.subarray(0x0, 0x200),
			e: this.publicKeyData.subarray(0x200, 0x204)
		}, 'components-public');

		this.valid = publicKey.verify(this._certificateBody, this.signature);
	}

	_verifySignatureRSA2048(): void {
		const publicKey = new NodeRSA();

		publicKey.importKey({
			n: this.publicKeyData.subarray(0x0, 0x100),
			e: this.publicKeyData.subarray(0x100, 0x104)
		}, 'components-public');

		this.valid = publicKey.verify(this._certificateBody, this.signature);
	}

	// * Huge thanks to Myria for helping get ECDSA working
	// * with Nodes native crypto module and getting the keys
	// * from bytes to PEM!
	// * https://github.com/Myriachan
	_verifySignatureECDSA(): void {
		const pem = this.consoleType === 'wiiu' ? WIIU_DEVICE_PUB_PEM : CTR_DEVICE_PUB_PEM;
		const key = {
			key: pem,
			dsaEncoding: 'ieee-p1363' as crypto.DSAEncoding
		};

		this.valid = crypto.verify('sha256', this._certificateBody, key, this.signature);
	}

	_verifySignatureLFCS(): void {
		const publicKey = new NodeRSA();

		publicKey.importKey({
			n: CTR_LFCS_B_PUB,
			e: 65537,
		}, 'components-public');

		this.valid = publicKey.verify(this._certificateBody, this.signature);
	}
}

export default NintendoCertificate;