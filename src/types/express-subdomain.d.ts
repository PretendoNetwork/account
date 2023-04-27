// * Credit to https://github.com/bmullan91/express-subdomain/pull/61 for the types!

declare module 'express-subdomain'{
	import type { Request, Response, Router } from 'express';

	/**
	 * @description The subdomain function.
	 * @param subdomain The subdomain to listen on.
	 * @param fn The listener function, takes a response and request.
	 * @returns A function call to the value passed as FN, or void (the next function).
	 */
	export default function subdomain(
		subdomain: string,
		fn: Router | ((req: Request, res: Response) => void | any)
	): (req: Request, res: Response, next: () => void) => void | typeof fn;
}