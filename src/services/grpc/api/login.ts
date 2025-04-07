import { Status, ServerError } from 'nice-grpc';
import { LoginRequest, LoginResponse, DeepPartial } from '@pretendonetwork/grpc/api/login_rpc';
import bcrypt from 'bcrypt';
import { getPNIDByUsername, getPNIDByAPIRefreshToken } from '@/database';
import { nintendoPasswordHash, generateOAuthTokens} from '@/util';
import type { HydratedPNIDDocument } from '@/types/mongoose/pnid';
import { SystemType } from '@/types/common/token';

export async function login(request: LoginRequest): Promise<DeepPartial<LoginResponse>> {
	const grantType = request.grantType?.trim();
	const username = request.username?.trim();
	const password = request.password?.trim();
	const refreshToken = request.refreshToken?.trim();

	if (!['password', 'refresh_token'].includes(grantType)) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid grant type');
	}

	let pnid: HydratedPNIDDocument | null;

	if (grantType === 'password') {
		if (!username) throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid or missing username');
		if (!password) throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid or missing password');

		pnid = await getPNIDByUsername(username);

		if (!pnid) throw new ServerError(Status.INVALID_ARGUMENT, 'User not found');

		const hashedPassword = nintendoPasswordHash(password, pnid.pid);

		if (!bcrypt.compareSync(hashedPassword, pnid.password)) {
			throw new ServerError(Status.INVALID_ARGUMENT, 'Password is incorrect');
		}
	} else if (grantType === 'refresh_token') {
		if (!refreshToken) throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid or missing refresh token');

		pnid = await getPNIDByAPIRefreshToken(refreshToken);

		if (!pnid) throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid or missing refresh token');
	} else {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid grant type');
	}

	if (pnid.deleted) {
		throw new ServerError(Status.UNAUTHENTICATED, 'Account has been deleted');
	}

	try {
		const tokenGeneration = generateOAuthTokens(SystemType.API, pnid, { refreshExpiresIn: 14 * 24 * 60 * 60 }); // * 14 days

		return {
			accessToken: tokenGeneration.accessToken,
			tokenType: 'Bearer',
			expiresIn: tokenGeneration.expiresInSecs.access,
			refreshToken: tokenGeneration.refreshToken
		};
	} catch {
		throw new ServerError(Status.INTERNAL, 'Could not generate OAuth tokens');
	}
}