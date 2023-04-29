import { createServer, Server } from 'nice-grpc';
import { AccountServiceImplementation, AccountDefinition } from 'pretendo-grpc-ts/dist/account/account_service';
import { config } from '@/config-manager';

import { apiKeyMiddleware } from '@/services/grpc/api-key-middleware';
import { getUserData } from '@/services/grpc/get-user-data';
import { login } from '@/services/grpc/login';
import { registerPNID } from '@/services/grpc/register-pnid';

const accountServiceImplementation: AccountServiceImplementation = {
	getUserData,
	login,
	registerPNID,
};

export async function startGRPCServer(): Promise<void> {
	const server: Server = createServer().use(apiKeyMiddleware);

	server.add(AccountDefinition, accountServiceImplementation);

	await server.listen(`0.0.0.0:${config.grpc.port}`);
}