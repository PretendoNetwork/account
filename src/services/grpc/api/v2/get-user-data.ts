import { config } from '@/config-manager';
import type { CallContext } from 'nice-grpc';
import type { GetUserDataResponse, DeepPartial } from '@pretendonetwork/grpc/api/v2/get_user_data_rpc';
import type { Empty } from '@pretendonetwork/grpc/google/protobuf/empty';
import type { AuthenticationCallContextExt } from '@/services/grpc/api/v1/authentication-middleware';

export async function getUserData(_request: Empty, context: CallContext & AuthenticationCallContextExt): Promise<DeepPartial<GetUserDataResponse>> {
	// * This is asserted in authentication-middleware, we know this is never null
	const pnid = context.pnid!;

	return {
		deleted: pnid.deleted || pnid.marked_for_deletion,
		creationDate: pnid.creation_date,
		updatedDate: pnid.updated,
		pid: pnid.pid,
		username: pnid.username,
		accessLevel: pnid.access_level,
		serverAccessLevel: pnid.server_access_level,
		mii: {
			name: pnid.mii.name,
			data: pnid.mii.data,
			url: `${config.cdn.base_url}/mii/${pnid.pid}/standard.tga`
		},
		birthday: pnid.birthdate,
		gender: pnid.gender,
		country: pnid.country,
		timezone: pnid.timezone.name,
		language: pnid.language,
		emailAddress: pnid.email.address,
		connections: {
			discord: {
				id: pnid.connections.discord.id
			},
			stripe: {
				customerId: pnid.connections.stripe.customer_id,
				subscriptionId: pnid.connections.stripe.subscription_id,
				priceId: pnid.connections.stripe.price_id,
				tierLevel: pnid.connections.stripe.tier_level,
				tierName: pnid.connections.stripe.tier_name,
				latestWebhookTimestamp: BigInt(pnid.connections.stripe.latest_webhook_timestamp ?? 0)
			}
		},
		marketingFlag: pnid.flags.marketing
	};
}
