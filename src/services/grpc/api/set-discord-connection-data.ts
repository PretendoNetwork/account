import { Status, ServerError, CallContext } from 'nice-grpc';
import { SetDiscordConnectionDataRequest } from 'pretendo-grpc-ts/dist/api/set_discord_connection_data_rpc';
import type { Empty } from 'pretendo-grpc-ts/dist/api/google/protobuf/empty';
import type { AuthenticationCallContextExt } from '@/services/grpc/api/authentication-middleware';
import type { HydratedPNIDDocument } from '@/types/mongoose/pnid';

export async function setDiscordConnectionData(request: SetDiscordConnectionDataRequest, context: CallContext & AuthenticationCallContextExt): Promise<Empty>{
	// * This is asserted in authentication-middleware, we know this is never null
	const pnid: HydratedPNIDDocument = context.pnid!;

	try {
		pnid.connections.discord.id = request.id;

		await pnid.save();
	} catch (error) {
		let message: string = 'Unknown Mongo error';

		if (error instanceof Error) {
			message = error.message;
		}

		throw new ServerError(Status.INVALID_ARGUMENT, message);
	}

	return {};
}