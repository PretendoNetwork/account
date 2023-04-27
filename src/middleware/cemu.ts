import express from 'express';

function CemuMiddleware(request: express.Request, _response: express.Response, next: express.NextFunction): void {
	const subdomain: string = request.subdomains.reverse().join('.');

	request.isCemu = subdomain === 'c.account';

	return next();
}

export default CemuMiddleware;