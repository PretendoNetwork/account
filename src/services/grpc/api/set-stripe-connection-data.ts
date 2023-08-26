import { Status, ServerError, CallContext } from 'nice-grpc';
import { SetStripeConnectionDataRequest } from '@pretendonetwork/grpc/api/set_stripe_connection_data_rpc';
import { PNID } from '@/models/pnid';
import type { Empty } from '@pretendonetwork/grpc/api/google/protobuf/empty';
import type { AuthenticationCallContextExt } from '@/services/grpc/api/authentication-middleware';
import type { HydratedPNIDDocument } from '@/types/mongoose/pnid';

type StripeMongoUpdateScheme = {
	access_level?: number;
	server_access_level?: string;
	'connections.stripe.customer_id'?: string;
	'connections.stripe.subscription_id'?: string;
	'connections.stripe.price_id'?: string;
	'connections.stripe.tier_level'?: number;
	'connections.stripe.tier_name'?: string;
	'connections.stripe.latest_webhook_timestamp': number;
};

export async function setStripeConnectionData(request: SetStripeConnectionDataRequest, context: CallContext & AuthenticationCallContextExt): Promise<Empty>{
	// * This is asserted in authentication-middleware, we know this is never null
	const pnid: HydratedPNIDDocument = context.pnid!;

	const updateData: StripeMongoUpdateScheme = {
		'connections.stripe.latest_webhook_timestamp': Number(request.timestamp)
	};

	if (request.customerId && !pnid.connections.stripe.customer_id) {
		updateData['connections.stripe.customer_id'] = request.customerId;
	}

	// * These checks allow for null/0 values in order to reset data if needed

	if (request.accessLevel !== undefined) {
		updateData.access_level = request.accessLevel;
	}

	if (request.serverAccessLevel !== undefined) {
		updateData.server_access_level = request.serverAccessLevel;
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
				pid: pnid.pid,
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
		let message: string = 'Unknown Mongo error';

		if (error instanceof Error) {
			message = error.message;
		}

		throw new ServerError(Status.INVALID_ARGUMENT, message);
	}

	return {};
}