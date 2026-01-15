import { Status, ServerError } from 'nice-grpc';
import type { ExchangePasswordResetTokenForUserDataRequest, ExchangePasswordResetTokenForUserDataResponse } from '@pretendonetwork/grpc/account/v2/exchange_password_reset_token_for_user_data_rpc';

export async function exchangePasswordResetTokenForUserData(_request: ExchangePasswordResetTokenForUserDataRequest): Promise<ExchangePasswordResetTokenForUserDataResponse> {
	throw new ServerError(
		Status.UNIMPLEMENTED,
		'Stubbed'
	);
}
