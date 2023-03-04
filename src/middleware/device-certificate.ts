import NintendoCertificate from '@nintendo-certificate';

export async function deviceCertificateMiddleware(request, _response, next) {
	const { headers } = request;

	if (!headers['x-nintendo-device-cert']) {
		return next();
	}

	const certificate = headers['x-nintendo-device-cert'];
	request.certificate = new NintendoCertificate(certificate);

	return next();
}

export default deviceCertificateMiddleware;