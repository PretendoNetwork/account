import express from 'express';
import NintendoCertificate from '@/nintendo-certificate';

function deviceCertificateMiddleware(request: express.Request, _response: express.Response, next: express.NextFunction): void {
	const certificate: string = request.headers['x-nintendo-device-cert'] as string;

	if (!certificate) {
		return next();
	}

	request.certificate = new NintendoCertificate(certificate);

	return next();
}

export default deviceCertificateMiddleware;