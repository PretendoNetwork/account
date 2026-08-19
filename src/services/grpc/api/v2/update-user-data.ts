import { ServerError, Status } from 'nice-grpc';
import Mii from 'mii-js';
import { isValidBirthday } from '@/util';
import { config } from '@/config-manager';
import timezones from '@/services/nnas/timezones.json';
import regionsList from '@/services/nnas/regions.json';
import type { CallContext } from 'nice-grpc';
import type {
	UpdateUserDataRequest,
	DeepPartial
} from '@pretendonetwork/grpc/api/v2/update_user_data_rpc';
import type { GetUserDataResponse } from '@pretendonetwork/grpc/api/v2/get_user_data_rpc';
import type { AuthenticationCallContextExt } from '@/services/grpc/api/v1/authentication-middleware';

export async function updateUserData(
	request: UpdateUserDataRequest,
	context: CallContext & AuthenticationCallContextExt
): Promise<DeepPartial<GetUserDataResponse>> {
	// * This is asserted in authentication-middleware, we know this is never null
	const pnid = context.pnid!;

	const serverAccessLevel = request.serverAccessLevel?.trim();
	const mii = request?.mii?.trim();
	const birthday = request.birthday?.trim();
	const gender = request.gender?.trim();
	const country = request.country?.trim();
	const region = request.region;
	const timezone = request.timezone?.trim();

	/* TODO: implement these if/when needed */
	// const language = request.language?.trim();
	// const marketingFlag = request.marketingFlag;

	if (serverAccessLevel) {
		if (['prod', 'test', 'dev'].includes(serverAccessLevel)) {
			if (pnid.access_level > 0 && pnid.access_level < 4) {
				if (
					(serverAccessLevel === 'test' && pnid.access_level < 1) ||
					(serverAccessLevel === 'dev' && pnid.access_level < 3)
				) {
					throw new ServerError(
						Status.INVALID_ARGUMENT,
						`Do not have permission to enter this environment`
					);
				}

				pnid.server_access_level = serverAccessLevel;
			} else {
				throw new ServerError(Status.PERMISSION_DENIED, `Banned.`);
			}
		} else {
			throw new ServerError(
				Status.INVALID_ARGUMENT,
				`Must be one of: prod, test, dev`
			);
		}
	}

	if (birthday) {
		if (isValidBirthday(birthday)) {
			pnid.birthdate = birthday;
		} else {
			throw new ServerError(
				Status.INVALID_ARGUMENT,
				`Must be a valid date formatted as: YYYY-MM-DD`
			);
		}
	}

	if (gender) {
		if (['M', 'F'].includes(gender)) {
			pnid.gender = gender;
		} else {
			throw new ServerError(
				Status.INVALID_ARGUMENT,
				`Must be one of: F, M`
			);
		}
	}

	if (country || region) {
		let countryId = 0;

		// if we have a region but no country, we extract the country id from it
		if (region && !country) {
			const regionHex = region.toString(16).padStart(8, '0');
			countryId = parseInt(regionHex.slice(0, 2), 16);
		}

		const countryObj = regionsList.find((c) => {
			return c.iso_code === country || c.id === countryId;
		});

		if (!countryObj?.iso_code) {
			throw new ServerError(Status.INVALID_ARGUMENT, `Invalid country`);
		}

		if (region) {
			const regionObj = countryObj.regions.find((r) => {
				return r.id === region;
			});

			if (!regionObj) {
				throw new ServerError(
					Status.INVALID_ARGUMENT,
					`Invalid region`
				);
			} else {
				pnid.country = countryObj.iso_code;
				pnid.region = region;
			}
		} else if (pnid.country !== countryObj?.iso_code) {
			// if editing the country with no explicit region, set it to Unspecified
			pnid.country = countryObj.iso_code;
			pnid.region = countryObj.regions.find(
				r => r.name === 'Unspecified'
			)!.id;
		}
	}

	if (timezone) {
		const pnidCountryTimezones =
			timezones[pnid.country as keyof typeof timezones];
		// using japanese because some timezones are only available in that locale
		const newTimezone = pnidCountryTimezones.ja.find(
			t => t.area === timezone
		);
		if (newTimezone) {
			pnid.timezone.name = newTimezone.area;
			pnid.timezone.offset = Number(newTimezone.utc_offset);
		} else {
			throw new ServerError(Status.INVALID_ARGUMENT, `Invalid timezone`);
		}
	}

	if (mii) {
		try {
			const parsedMii: Mii = new Mii(Buffer.from(mii, 'base64'));

			parsedMii.validate();

			await pnid.updateMii({
				name: parsedMii.miiName,
				primary: 'Y',
				data: parsedMii.encode().toString('base64')
			});
		} catch {
			throw new ServerError(Status.INVALID_ARGUMENT, `Invalid mii data`);
		}
	}

	await pnid.save();

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
		region: pnid.region,
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
				latestWebhookTimestamp: BigInt(
					pnid.connections.stripe.latest_webhook_timestamp ?? 0
				)
			}
		},
		marketingFlag: pnid.flags.marketing
	};
}
