import express from 'express';
import xmlbuilder from 'xmlbuilder';

// TODO - I'm unsure if this is the best place for this file to be or the best place to put these functions. It's fine for now though
// TODO - Support JSON mode

type CreateNNASErrorResponseOptions = {
	status?: number;
	errors: {
		cause?: string;
		code?: string;
		message?: string;
	}[];
}

type CreateNNASResponseOptions = {
	status?: number;
	body: Record<string, any>;
}

// TODO - This can largely be removed once an upgrade to Express v5 is done, since v5 supports throwing errors in async routes
export function createNNASErrorResponse(response: express.Response, options: CreateNNASErrorResponseOptions): void {
	createNNASResponse(response, {
		status: options.status || 400,
		body: {
			// TODO - This is NOT suitable for JSON mode. Hack to get xmlbuilder to properly build XML error lists in the way we need it to. NNAS formats JSON error lists as `{"errors":[{"code":"0107","message":"Account country and device country do not match"}]}`
			errors: {
				error: options.errors
			}
		}
	});
}

export function createNNASResponse(response: express.Response, options: CreateNNASResponseOptions): void {
	response.set('Content-Type', 'text/xml');
	response.set('Server', 'Nintendo 3DS (http)');
	response.set('X-Nintendo-Date', new Date().getTime().toString());

	const body = xmlbuilder
		.create(options.body)
		.commentBefore('WARNING! DO NOT SHARE ANYTHING IN THIS REQUEST OR RESPONSE WITH UNTRUSTED USERS! REQUESTS AND RESPONSES CONTAIN SENSITIVE INFORMATION ABOUT YOUR DEVICE/ACCOUNT SUCH AS PASSWORDS, EMAILS, CERTIFICATES, ETC!').end();

	response.status(options.status || 200).send(body);
}