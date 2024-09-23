import express from 'express';

export function restrictHostnames<TFn extends express.Router>(
	allowedHostnames: string[],
	fn: TFn
): (req: express.Request, res: express.Response, next: () => void) => void | TFn {
	return (req: express.Request, res: express.Response, next: () => void) => {
		if (!allowedHostnames.includes(req.hostname)) {
			return fn(req, res, next);
		}

		return next();
	};
}