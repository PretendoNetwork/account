import { Status, ServerError } from 'nice-grpc';
import { LoginRequest, LoginResponse, DeepPartial } from '@pretendonetwork/grpc/api/login_rpc';
import bcrypt from 'bcrypt';
import { getPNIDByUsername, getPNIDByAPIRefreshToken } from '@/database';
import { nintendoPasswordHash, generateOAuthTokens} from '@/util';
import type { HydratedPNIDDocument } from '@/types/mongoose/pnid';

export async function login(request: LoginRequest): Promise<DeepPartial<LoginResponse>> {
	const grantType = request.grantType?.trim();
	const username = request.username?.trim();
	const password = request.password?.trim();
	const refreshToken = request.refreshToken?.trim();

	if (!['password', 'refresh_token'].includes(grantType)) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid grant type');
	}

	if (grantType === 'password' && !username) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid or missing username');
	}

	if (grantType === 'password' && !password) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid or missing password');
	}

	if (grantType === 'refresh_token' && !refreshToken) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid or missing refresh token');
	}

	let pnid: HydratedPNIDDocument | null;

	if (grantType === 'password') {
		pnid = await getPNIDByUsername(username!); // * We know username will never be null here

		if (!pnid) {
			throw new ServerError(Status.INVALID_ARGUMENT, 'User not found');
		}

		const hashedPassword = nintendoPasswordHash(password!, pnid.pid); // * We know password will never be null here

		if (!bcrypt.compareSync(hashedPassword, pnid.password)) {
			throw new ServerError(Status.INVALID_ARGUMENT, 'Password is incorrect');
		}
	} else {
		pnid = await getPNIDByAPIRefreshToken(refreshToken!); // * We know refreshToken will never be null here

		if (!pnid) {
			throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid or missing refresh token');
		}
	}

	if (pnid.deleted) {
		throw new ServerError(Status.UNAUTHENTICATED, 'Account has been deleted');
	}

	try {
		const systemType = 0x3; // * API
		const { accessToken, refreshToken, accessTokenExpiresInSecs } = generateOAuthTokens(systemType, pnid);

		return {
			accessToken: accessToken,
			tokenType: 'Bearer',
			expiresIn: accessTokenExpiresInSecs,
			refreshToken: refreshToken
		};
	} catch {
		throw new ServerError(Status.INTERNAL, 'Could not generate OAuth tokens');
	}
}