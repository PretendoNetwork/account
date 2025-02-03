import { createServer } from 'nice-grpc';
import { AccountDefinition } from '@pretendonetwork/grpc/account/account_service';
import { APIDefinition } from '@pretendonetwork/grpc/api/api_service';
import { apiKeyMiddleware as accountApiKeyMiddleware } from '@/services/grpc/account/api-key-middleware';
import { apiKeyMiddleware as apiApiKeyMiddleware } from '@/services/grpc/api/api-key-middleware';
import { authenticationMiddleware as apiAuthenticationMiddleware } from '@/services/grpc/api/authentication-middleware';
import { accountServiceImplementation } from '@/services/grpc/account/implementation';
import { apiServiceImplementation } from '@/services/grpc/api/implementation';
import { config } from '@/config-manager';

export async function startGRPCServer(): Promise<void> {
	const server = createServer();

	server.with(accountApiKeyMiddleware).add(AccountDefinition, accountServiceImplementation);
	server.with(apiApiKeyMiddleware).with(apiAuthenticationMiddleware).add(APIDefinition, apiServiceImplementation);

	await server.listen(`0.0.0.0:${config.grpc.port}`);
}
