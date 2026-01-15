import { Status, ServerError } from 'nice-grpc';
import type { ValidateIndependentServiceTokenRequest, ValidateIndependentServiceTokenResponse } from '@pretendonetwork/grpc/account/v2/validate_independent_service_token_rpc';

export async function validateIndependentServiceToken(_request: ValidateIndependentServiceTokenRequest): Promise<ValidateIndependentServiceTokenResponse> {
	throw new ServerError(
		Status.UNIMPLEMENTED,
		'Stubbed'
	);
}
