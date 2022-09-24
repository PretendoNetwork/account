const NintendoCertificate = require('../nintendo-certificate');

async function deviceCertificateMiddleware(request, response, next) {
	const { headers } = request;

	if (!headers['x-nintendo-device-cert']) {
		return next();
	}

	const certificate = headers['x-nintendo-device-cert'];
	request.certificate = new NintendoCertificate(certificate);

	return next();
}

module.exports = deviceCertificateMiddleware;