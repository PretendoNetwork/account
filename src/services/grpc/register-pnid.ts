import { Status, ServerError } from 'nice-grpc';
import { RegisterPNIDRequest, DeepPartial } from 'pretendo-grpc-ts/dist/account/register_pnid_rpc';
import { LoginResponse } from 'pretendo-grpc-ts/dist/account/login_rpc';

export async function registerPNID(_request: RegisterPNIDRequest): Promise<DeepPartial<LoginResponse>> {
	throw new ServerError(Status.UNIMPLEMENTED, 'Register PNID method not implemented');
}