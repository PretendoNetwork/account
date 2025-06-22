import { Status, ServerError } from 'nice-grpc';
import bcrypt from 'bcrypt';
import { getPNIDByUsername, getPNIDByTokenAuth } from '@/database';
import { nintendoPasswordHash, generateToken } from '@/util';
import { config } from '@/config-manager';
import { SystemType } from '@/types/common/system-types';
import { TokenType } from '@/types/common/token-types';
import type { LoginRequest, LoginResponse, DeepPartial } from '@pretendonetwork/grpc/api/v2/login_rpc';
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
		pnid = await getPNIDByTokenAuth(refreshToken!); // * We know refreshToken will never be null here

		if (!pnid) {
			throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid or missing refresh token');
		}
	}

	if (pnid.deleted) {
		throw new ServerError(Status.UNAUTHENTICATED, 'Account has been deleted');
	}

	const accessTokenOptions = {
		system_type: SystemType.API,
		token_type: TokenType.OAuthAccess,
		pid: pnid.pid,
		access_level: pnid.access_level,
		title_id: BigInt(0),
		expire_time: BigInt(Date.now() + (3600 * 1000))
	};

	const refreshTokenOptions = {
		system_type: SystemType.API,
		token_type: TokenType.OAuthAccess,
		pid: pnid.pid,
		access_level: pnid.access_level,
		title_id: BigInt(0),
		expire_time: BigInt(Date.now() + 12 * 3600 * 1000)
	};

	const accessTokenBuffer = await generateToken(config.aes_key, accessTokenOptions);
	const refreshTokenBuffer = await generateToken(config.aes_key, refreshTokenOptions);

	if (!accessTokenBuffer) {
		throw new ServerError(Status.INTERNAL, 'Failed to generate access token');
	}

	if (!refreshTokenBuffer) {
		throw new ServerError(Status.INTERNAL, 'Failed to generate refresh token');
	}

	return {
		accessToken: accessTokenBuffer.toString('hex'),
		tokenType: 'Bearer',
		expiresIn: 3600,
		refreshToken: refreshTokenBuffer.toString('hex')
	};
}
