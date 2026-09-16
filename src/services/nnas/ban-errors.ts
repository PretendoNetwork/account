import { BanTargetType, BanScopeType } from '@pretendonetwork/grpc/account/v2/ban_details';
import { PERMANENT_BAN_END_DATE } from '@/models/ban';
import type { IBan } from '@/types/mongoose/ban';

interface NNASBanError {
	code: string;
	message: string;
}

interface NNASBanErrors {
	permanent: NNASBanError;
	temporary: NNASBanError;
}

type BanScope = BanScopeType.BAN_SCOPE_TYPE_ALL | BanScopeType.BAN_SCOPE_TYPE_APPLICATION | BanScopeType.BAN_SCOPE_TYPE_NEX_SERVICE | BanScopeType.BAN_SCOPE_TYPE_INDEPENDENT_SERVICE;

// * https://nintendo.wiki/wiki/Nintendo_Network/NNAS#Error_Codes
// * The codes for:
// * - BANNED
// * - BANNED_ACCOUNT
// * - BANNED_DEVICE
// * - BANNED_ACCOUNT_TEMPORARILY
// * - BANNED_DEVICE_TEMPORARILY
// * are unknown, and it's not known how they differ from the other ban errors
export const NNAS_BAN_ERRORS: Record<'account' | 'device', Record<BanScope, NNASBanErrors>> = {
	account: {
		[BanScopeType.BAN_SCOPE_TYPE_ALL]: {
			permanent: {
				code: '0108', // * BANNED_ACCOUNT_ALL
				message: 'Account has been banned' // TODO - Unknown official message, this is a guess
			},
			temporary: {
				code: '0132', // * BANNED_ACCOUNT_ALL_TEMPORARILY
				message: 'Account has been temporarily banned' // TODO - Unknown official message, this is a guess
			}
		},
		[BanScopeType.BAN_SCOPE_TYPE_APPLICATION]: {
			permanent: {
				code: '0119', // * BANNED_ACCOUNT_IN_APPLICATION
				message: 'Account has been banned by application' // TODO - Unknown official message, this is a guess
			},
			temporary: {
				code: '0134', // * BANNED_ACCOUNT_IN_APPLICATION_TEMPORARILY
				message: 'Account has been temporarily banned by application' // TODO - Unknown official message, this is a guess
			}
		},
		[BanScopeType.BAN_SCOPE_TYPE_NEX_SERVICE]: {
			permanent: {
				code: '0121', // * BANNED_ACCOUNT_IN_NEX_SERVICE
				message: 'Account has been banned by game server' // TODO - Unknown official message, this is a guess
			},
			temporary: {
				code: '0136', // * BANNED_ACCOUNT_IN_NEX_SERVICE_TEMPORARILY
				message: 'Account has been temporarily banned by game server' // TODO - Unknown official message, this is a guess
			}
		},
		[BanScopeType.BAN_SCOPE_TYPE_INDEPENDENT_SERVICE]: {
			permanent: {
				code: '0126', // * BANNED_ACCOUNT_IN_INDEPENDENT_SERVICE
				message: 'Account has been banned by independent service' // TODO - Unknown official message, this is a guess
			},
			temporary: {
				code: '0138', // * BANNED_ACCOUNT_IN_INDEPENDENT_SERVICE_TEMPORARILY
				message: 'Account has been temporarily banned by independent service' // TODO - Unknown official message, this is a guess
			}
		}
	},
	device: {
		[BanScopeType.BAN_SCOPE_TYPE_ALL]: {
			permanent: {
				code: '0012', // * BANNED_DEVICE_ALL
				message: 'Device has been banned' // TODO - Unknown official message, this is a guess
			},
			temporary: {
				code: '0133', // * BANNED_DEVICE_ALL_TEMPORARILY
				message: 'Device has been temporarily banned' // TODO - Unknown official message, this is a guess
			}
		},
		[BanScopeType.BAN_SCOPE_TYPE_APPLICATION]: {
			permanent: {
				code: '0120', // * BANNED_DEVICE_IN_APPLICATION
				message: 'Device has been banned by application' // TODO - Unknown official message, this is a guess
			},
			temporary: {
				code: '0135', // * BANNED_DEVICE_IN_APPLICATION_TEMPORARILY
				message: 'Device has been temporarily banned by application' // TODO - Unknown official message, this is a guess
			}
		},
		[BanScopeType.BAN_SCOPE_TYPE_NEX_SERVICE]: {
			permanent: {
				code: '0122', // * BANNED_DEVICE_IN_NEX_SERVICE
				message: 'Device has been banned by game server'
			},
			temporary: {
				code: '0137', // * BANNED_DEVICE_IN_NEX_SERVICE_TEMPORARILY
				message: 'Device has been temporarily banned by game server' // TODO - Unknown official message, this is a guess
			}
		},
		[BanScopeType.BAN_SCOPE_TYPE_INDEPENDENT_SERVICE]: {
			permanent: {
				code: '0127', // * BANNED_DEVICE_IN_INDEPENDENT_SERVICE
				message: 'Device has been banned by independent service' // TODO - Unknown official message, this is a guess
			},
			temporary: {
				code: '0139', // * BANNED_DEVICE_IN_INDEPENDENT_SERVICE_TEMPORARILY
				message: 'Device has been temporarily banned by independent service' // TODO - Unknown official message, this is a guess
			}
		}
	}
};

export function getNNASBanError(ban: IBan): NNASBanError {
	const errors = ban.target_type === BanTargetType.BAN_TARGET_TYPE_DEVICE ? NNAS_BAN_ERRORS.device : NNAS_BAN_ERRORS.account;
	const scopeErrors = errors[ban.scope_type as BanScope] ?? errors[BanScopeType.BAN_SCOPE_TYPE_ALL];

	return ban.end_date.getTime() === PERMANENT_BAN_END_DATE.getTime() ? scopeErrors.permanent : scopeErrors.temporary;
}
