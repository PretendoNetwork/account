import { Status, ServerError } from 'nice-grpc';
import type { CallContext } from 'nice-grpc';
import type { SetDiscordConnectionDataRequest, SetDiscordConnectionDataResponse } from '@pretendonetwork/grpc/api/v2/set_discord_connection_data_rpc';
import type { AuthenticationCallContextExt } from '@/services/grpc/api/v1/authentication-middleware';

export async function setDiscordConnectionData(request: SetDiscordConnectionDataRequest, context: CallContext & AuthenticationCallContextExt): Promise<SetDiscordConnectionDataResponse> {
	// * This is asserted in authentication-middleware, we know this is never null
	const pnid = context.pnid!;

	try {
		pnid.connections.discord.id = request.id;

		await pnid.save();
	} catch (error) {
		let message = 'Unknown Mongo error';

		if (error instanceof Error) {
			message = error.message;
		}

		throw new ServerError(Status.INVALID_ARGUMENT, message);
	}

	return {};
}
