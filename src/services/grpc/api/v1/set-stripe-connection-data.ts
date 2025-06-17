import { Status, ServerError } from 'nice-grpc';
import { PNID } from '@/models/pnid';
import type { CallContext } from 'nice-grpc';
import type { SetStripeConnectionDataRequest } from '@pretendonetwork/grpc/api/set_stripe_connection_data_rpc';
import type { Empty } from '@pretendonetwork/grpc/google/protobuf/empty';
import type { AuthenticationCallContextExt } from '@/services/grpc/api/v1/authentication-middleware';

type StripeMongoUpdateScheme = {
	'access_level'?: number;
	'server_access_level'?: string;
	'connections.stripe.customer_id'?: string;
	'connections.stripe.subscription_id'?: string;
	'connections.stripe.price_id'?: string;
	'connections.stripe.tier_level'?: number;
	'connections.stripe.tier_name'?: string;
	'connections.stripe.latest_webhook_timestamp': number;
};

export async function setStripeConnectionData(request: SetStripeConnectionDataRequest, context: CallContext & AuthenticationCallContextExt): Promise<Empty> {
	// * This is asserted in authentication-middleware, we know this is never null
	const pnid = context.pnid!;

	const updateData: StripeMongoUpdateScheme = {
		'connections.stripe.latest_webhook_timestamp': Number(request.timestamp)
	};

	if (request.customerId && !pnid.connections.stripe.customer_id) {
		updateData['connections.stripe.customer_id'] = request.customerId;
	}

	if (request.subscriptionId !== undefined) {
		updateData['connections.stripe.subscription_id'] = request.subscriptionId;
	}

	if (request.subscriptionId !== undefined) {
		updateData['connections.stripe.subscription_id'] = request.subscriptionId;
	}

	if (request.priceId !== undefined) {
		updateData['connections.stripe.price_id'] = request.priceId;
	}

	if (request.tierLevel !== undefined) {
		updateData['connections.stripe.tier_level'] = request.tierLevel;
	}

	if (request.tierName !== undefined) {
		updateData['connections.stripe.tier_name'] = request.tierName;
	}

	try {
		if (pnid.connections.stripe.latest_webhook_timestamp && pnid.connections.stripe.customer_id) {
			// * Stripe customer data has already been initialized, update it
			await PNID.updateOne({
				'pid': pnid.pid,
				'connections.stripe.latest_webhook_timestamp': {
					$lte: request.timestamp
				}
			}, { $set: updateData }).exec();
		} else {
			// * Initialize a new Stripe user
			if (!request.customerId) {
				throw new ServerError(Status.INVALID_ARGUMENT, 'No Stripe user data found and no custom ID provided');
			}

			PNID.updateOne({ pid: pnid.pid }, {
				$set: updateData
			}, { upsert: true }).exec();
		}
	} catch (error) {
		let message = 'Unknown Mongo error';

		if (error instanceof Error) {
			message = error.message;
		}

		throw new ServerError(Status.INVALID_ARGUMENT, message);
	}

	return {};
}
