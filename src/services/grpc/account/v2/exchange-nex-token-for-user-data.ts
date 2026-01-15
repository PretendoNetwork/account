import { Status, ServerError } from 'nice-grpc';
import type { ExchangeNEXTokenForUserDataRequest, ExchangeNEXTokenForUserDataResponse } from '@pretendonetwork/grpc/account/v2/exchange_nex_token_for_user_data_rpc';

export async function exchangeNEXTokenForUserData(_request: ExchangeNEXTokenForUserDataRequest): Promise<ExchangeNEXTokenForUserDataResponse> {
	throw new ServerError(
		Status.UNIMPLEMENTED,
		'Stubbed'
	);
}
