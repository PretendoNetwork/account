async function CemuMiddleware(request, response, next) {
	const subdomain = request.subdomains.reverse().join('.');

	request.isCemu = subdomain === 'c.account';

	return next();
}

module.exports = CemuMiddleware;