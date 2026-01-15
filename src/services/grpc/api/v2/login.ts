import crypto from 'node:crypto';
import { Status, ServerError } from 'nice-grpc';
import bcrypt from 'bcrypt';
import { getPNIDByUsername, getPNIDByAPIRefreshToken } from '@/database';
import { nintendoPasswordHash } from '@/util';
import { OAuthToken } from '@/models/oauth_token';
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
		pnid = await getPNIDByAPIRefreshToken(refreshToken!); // * We know refreshToken will never be null here

		if (!pnid) {
			throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid or missing refresh token');
		}
	}

	if (pnid.deleted) {
		throw new ServerError(Status.UNAUTHENTICATED, 'Account has been deleted');
	}

	const accessToken = crypto.randomBytes(16).toString('hex');
	const newRefreshToken = crypto.randomBytes(20).toString('hex');

	await OAuthToken.create({
		token: crypto.createHash('sha256').update(accessToken).digest('hex'),
		client_id: 'a2efa818a34fa16b8afbc8a74eba3eda', // TODO - This is the Wii U config, change this?
		client_secret: 'c91cdb5658bd4954ade78533a339cf9a', // TODO - This is the Wii U config, change this?
		pid: pnid.pid,
		info: {
			system_type: SystemType.API,
			token_type: TokenType.OAuthAccess,
			title_id: BigInt(0),
			issued: new Date(),
			expires: new Date(Date.now() + (3600 * 1000))
		}
	});

	await OAuthToken.create({
		token: crypto.createHash('sha256').update(newRefreshToken).digest('hex'),
		client_id: 'a2efa818a34fa16b8afbc8a74eba3eda', // TODO - This is the Wii U config, change this?
		client_secret: 'c91cdb5658bd4954ade78533a339cf9a', // TODO - This is the Wii U config, change this?
		pid: pnid.pid,
		info: {
			system_type: SystemType.API,
			token_type: TokenType.OAuthRefresh,
			title_id: BigInt(0),
			issued: new Date(),
			expires: new Date(Date.now() + 12 * 3600 * 1000)
		}
	});

	return {
		accessToken: accessToken,
		tokenType: 'Bearer',
		expiresIn: 3600,
		refreshToken: newRefreshToken
	};
}
