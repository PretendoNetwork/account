import { Status, ServerError } from 'nice-grpc';
import type { ListNEXAccountsRequest, ListNEXAccountsResponse } from '@pretendonetwork/grpc/account/v2/list_nex_accounts_rpc';

export async function listNEXAccounts(_request: ListNEXAccountsRequest): Promise<ListNEXAccountsResponse> {
	throw new ServerError(
		Status.UNIMPLEMENTED,
		'Stubbed'
	);
}
