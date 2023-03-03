export async function CemuMiddleware(request, _response, next) {
	const subdomain = request.subdomains.reverse().join('.');

	request.isCemu = subdomain === 'c.account';

	return next();
}

export default CemuMiddleware;