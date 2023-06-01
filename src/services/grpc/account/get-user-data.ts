import { Status, ServerError } from 'nice-grpc';
import { GetUserDataRequest, GetUserDataResponse, DeepPartial } from 'pretendo-grpc-ts/dist/account/get_user_data_rpc';
import { getPNIDByPID } from '@/database';
import { HydratedPNIDDocument } from '@/types/mongoose/pnid';
import { config } from '@/config-manager';

export async function getUserData(request: GetUserDataRequest): Promise<DeepPartial<GetUserDataResponse>> {
	const pnid: HydratedPNIDDocument | null = await getPNIDByPID(request.pid);

	if (!pnid) {
		throw new ServerError(
			Status.INVALID_ARGUMENT,
			'No PNID found',
		);
	}

	return {
		deleted: pnid.deleted,
		pid: pnid.pid,
		username: pnid.username,
		accessLevel: pnid.access_level,
		serverAccessLevel: pnid.server_access_level,
		mii: {
			name: pnid.mii.name,
			data: pnid.mii.data,
			url: `${config.cdn.base_url}/mii/${pnid.pid}/standard.tga`,
		},
		creationDate: pnid.creation_date,
		birthdate: pnid.birthdate,
		gender: pnid.gender,
		country: pnid.country,
		language: pnid.language,
		emailAddress: pnid.email.address,
		tierName: pnid.connections.stripe.tier_name
	};
}