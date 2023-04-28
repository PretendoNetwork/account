import { Status, ServerError } from 'nice-grpc';
import { LoginRequest, LoginResponse, DeepPartial } from 'pretendo-grpc-ts/dist/account/login_rpc';

export async function login(_request: LoginRequest): Promise<DeepPartial<LoginResponse>> {
	throw new ServerError(Status.UNIMPLEMENTED, 'Login method not implemented');
}