import { Status, ServerError } from 'nice-grpc';
import { config } from '@/config-manager';
import type { ServerMiddlewareCall, CallContext } from 'nice-grpc';

export async function* apiKeyMiddleware<Request, Response>(
	call: ServerMiddlewareCall<Request, Response>,
	context: CallContext
): AsyncGenerator<Response, Response | void, undefined> {
	const apiKey = context.metadata.get('X-API-Key');

	if (!apiKey || apiKey !== config.grpc.master_api_keys.api) {
		throw new ServerError(Status.UNAUTHENTICATED, 'Missing or invalid API key');
	}

	return yield* call.next(call.request, context);
}
