import express from 'express';
import NintendoCertificate from '@/nintendo-certificate';
import { getValueFromHeaders } from '@/util';

function deviceCertificateMiddleware(request: express.Request, _response: express.Response, next: express.NextFunction): void {
	const certificate: string | undefined = getValueFromHeaders(request.headers, 'x-nintendo-device-cert');

	if (!certificate) {
		return next();
	}

	request.certificate = new NintendoCertificate(certificate);

	return next();
}

export default deviceCertificateMiddleware;