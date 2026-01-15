import { Status, ServerError } from 'nice-grpc';
import type { ExchangeOAuthTokenForUserDataRequest, ExchangeOAuthTokenForUserDataResponse } from '@pretendonetwork/grpc/account/v2/exchange_oauth_token_for_user_data_rpc';

export async function exchangeOAuthTokenForUserData(_request: ExchangeOAuthTokenForUserDataRequest): Promise<ExchangeOAuthTokenForUserDataResponse> {
	throw new ServerError(
		Status.UNIMPLEMENTED,
		'Stubbed'
	);
}
