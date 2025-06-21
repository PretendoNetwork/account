import { createServer } from 'nice-grpc';
import { AccountDefinition as AccountServiceDefinitionV1 } from '@pretendonetwork/grpc/account/account_service';
import { APIDefinition as ApiServiceDefinitionV1 } from '@pretendonetwork/grpc/api/api_service';
import { AccountServiceDefinition as AccountServiceDefinitionV2 } from '@pretendonetwork/grpc/account/v2/account_service';
import { ApiServiceDefinition as ApiServiceDefinitionV2 } from '@pretendonetwork/grpc/api/v2/api_service';
import { apiKeyMiddleware as accountApiKeyMiddlewareV1 } from '@/services/grpc/account/v1/api-key-middleware';
import { apiKeyMiddleware as apiApiKeyMiddlewareV1 } from '@/services/grpc/api/v1/api-key-middleware';
import { authenticationMiddleware as apiAuthenticationMiddlewareV1 } from '@/services/grpc/api/v1/authentication-middleware';
import { accountServiceImplementationV1 } from '@/services/grpc/account/v1/implementation';
import { apiServiceImplementationV1 } from '@/services/grpc/api/v1/implementation';
import { apiKeyMiddleware as accountApiKeyMiddlewareV2 } from '@/services/grpc/account/v2/api-key-middleware';
import { apiKeyMiddleware as apiApiKeyMiddlewareV2 } from '@/services/grpc/api/v2/api-key-middleware';
import { authenticationMiddleware as apiAuthenticationMiddlewareV2 } from '@/services/grpc/api/v2/authentication-middleware';
import { accountServiceImplementationV2 } from '@/services/grpc/account/v2/implementation';
import { apiServiceImplementationV2 } from '@/services/grpc/api/v2/implementation';
import { config } from '@/config-manager';

export async function startGRPCServer(): Promise<void> {
	const server = createServer();

	server.with(accountApiKeyMiddlewareV1).add(AccountServiceDefinitionV1, accountServiceImplementationV1);
	server.with(apiApiKeyMiddlewareV1).with(apiAuthenticationMiddlewareV1).add(ApiServiceDefinitionV1, apiServiceImplementationV1);

	server.with(accountApiKeyMiddlewareV2).add(AccountServiceDefinitionV2, accountServiceImplementationV2);
	server.with(apiApiKeyMiddlewareV2).with(apiAuthenticationMiddlewareV2).add(ApiServiceDefinitionV2, apiServiceImplementationV2);

	await server.listen(`0.0.0.0:${config.grpc.port}`);
}
