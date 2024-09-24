import express from 'express';

export function restrictHostnames<TFn extends express.Router>(
	allowedHostnames: string[],
	fn: TFn
): (request: express.Request, response: express.Response, next: () => void) => void | TFn {
	return (request: express.Request, response: express.Response, next: () => void) => {
		if (!allowedHostnames.includes(request.hostname)) {
			return fn(request, response, next);

		}

		return next();
	};
}