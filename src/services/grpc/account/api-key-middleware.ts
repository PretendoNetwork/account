import { Status, ServerMiddlewareCall, CallContext, ServerError } from 'nice-grpc';
import { config } from '@/config-manager';

export async function* apiKeyMiddleware<Request, Response>(
	call: ServerMiddlewareCall<Request, Response>,
	context: CallContext,
): AsyncGenerator<Response, Response | void, undefined> {
	console.log(call.method);
	const apiKey: string | undefined = context.metadata.get('X-API-Key');

	if (!apiKey || apiKey !== config.grpc.master_api_keys.account) {
		throw new ServerError(Status.UNAUTHENTICATED, 'Missing or invalid API key');
	}

	return yield* call.next(call.request, context);
}