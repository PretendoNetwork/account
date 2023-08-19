import { Status, ServerError } from 'nice-grpc';
import { LoginRequest, LoginResponse, DeepPartial } from '@pretendonetwork/grpc/api/login_rpc';
import bcrypt from 'bcrypt';
import { getPNIDByUsername, getPNIDByTokenAuth } from '@/database';
import { nintendoPasswordHash, generateToken} from '@/util';
import { config } from '@/config-manager';
import type { TokenOptions } from '@/types/common/token-options';
import type { HydratedPNIDDocument } from '@/types/mongoose/pnid';

export async function login(request: LoginRequest): Promise<DeepPartial<LoginResponse>> {
	const grantType: string = request.grantType?.trim();
	const username: string | undefined = request.username?.trim();
	const password: string | undefined = request.password?.trim();
	const refreshToken: string | undefined = request.refreshToken?.trim();

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

		const hashedPassword: string = nintendoPasswordHash(password!, pnid.pid); // * We know password will never be null here

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

	const accessTokenOptions: TokenOptions = {
		system_type: 0x3, // * API
		token_type: 0x1, // * OAuth Access
		pid: pnid.pid,
		access_level: pnid.access_level,
		title_id: BigInt(0),
		expire_time: BigInt(Date.now() + (3600 * 1000))
	};

	const refreshTokenOptions: TokenOptions = {
		system_type: 0x3, // * API
		token_type: 0x2, // * OAuth Refresh
		pid: pnid.pid,
		access_level: pnid.access_level,
		title_id: BigInt(0),
		expire_time: BigInt(Date.now() + (3600 * 1000))
	};

	const accessTokenBuffer: Buffer | null = await generateToken(config.aes_key, accessTokenOptions);
	const refreshTokenBuffer: Buffer | null = await generateToken(config.aes_key, refreshTokenOptions);

	const accessToken: string = accessTokenBuffer ? accessTokenBuffer.toString('hex') : '';
	const newRefreshToken: string = refreshTokenBuffer ? refreshTokenBuffer.toString('hex') : '';

	// TODO - Handle null tokens

	return {
		accessToken: accessToken,
		tokenType: 'Bearer',
		expiresIn: 3600,
		refreshToken: newRefreshToken
	};
}