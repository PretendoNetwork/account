import NintendoCertificate from '@/nintendo-certificate';
import { getValueFromHeaders } from '@/util';
import type express from 'express';

function deviceCertificateMiddleware(request: express.Request, _response: express.Response, next: express.NextFunction): void {
	const certificate = getValueFromHeaders(request.headers, 'x-nintendo-device-cert');

	if (!certificate) {
		return next();
	}

	request.certificate = new NintendoCertificate(certificate);

	return next();
}

export default deviceCertificateMiddleware;
