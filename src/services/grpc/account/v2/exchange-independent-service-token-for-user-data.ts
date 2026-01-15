import { Status, ServerError } from 'nice-grpc';
import type { ExchangeIndependentServiceTokenForUserDataRequest, ExchangeIndependentServiceTokenForUserDataResponse } from '@pretendonetwork/grpc/account/v2/exchange_independent_service_token_for_user_data_rpc';

export async function exchangeIndependentServiceTokenForUserData(_request: ExchangeIndependentServiceTokenForUserDataRequest): Promise<ExchangeIndependentServiceTokenForUserDataResponse> {
	throw new ServerError(
		Status.UNIMPLEMENTED,
		'Stubbed'
	);
}
