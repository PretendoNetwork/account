import crypto from 'node:crypto';
import { Status, ServerError } from 'nice-grpc';
import { PasswordResetToken } from '@/models/password_reset_token';
import { Device } from '@/models/device';
import { SystemType } from '@/types/common/system-types';
import { TokenType } from '@/types/common/token-types';
import { getPNIDByPID } from '@/database';
import { PNID_PERMISSION_FLAGS } from '@/types/common/permission-flags';
import { config } from '@/config-manager';
import type { ExchangePasswordResetTokenForUserDataRequest, ExchangePasswordResetTokenForUserDataResponse } from '@pretendonetwork/grpc/account/v2/exchange_password_reset_token_for_user_data_rpc';
import type { HydratedPNIDDocument } from '@/types/mongoose/pnid';
import type { HydratedPasswordResetTokenDocument } from '@/models/password_reset_token';

export async function exchangePasswordResetTokenForUserData(request: ExchangePasswordResetTokenForUserDataRequest): Promise<ExchangePasswordResetTokenForUserDataResponse> {
	let pnid: HydratedPNIDDocument | null = null;
	let passwordResetToken: HydratedPasswordResetTokenDocument | null = null;
	try {
		passwordResetToken = await PasswordResetToken.findOne({
			token: crypto.createHash('sha256').update(request.token).digest('hex')
		});

		if (!passwordResetToken) {
			throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid token');
		}

		if (passwordResetToken.info.system_type !== SystemType.PasswordReset) {
			throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid token');
		}

		if (passwordResetToken.info.token_type !== TokenType.PasswordReset) {
			throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid token');
		}

		if (passwordResetToken.info.expires < new Date()) {
			throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid token');
		}

		pnid = await getPNIDByPID(passwordResetToken.pid);
	} catch {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid token');
	}

	if (!pnid) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid token. No user found');
	}

	const devices = (await Device.find({
		linked_pids: pnid.pid
	})).map((device) => {
		return {
			model: device.get('model'), // * ".model" gives the Mongoose model
			serial: device.serial,
			linkedPids: device.linked_pids,
			accessLevel: device.access_level,
			serverAccessLevel: device.server_access_level,
			deviceId: device.device_id
		};
	});

	return {
		pnid: {
			deleted: pnid.deleted,
			pid: pnid.pid,
			username: pnid.username,
			accessLevel: pnid.access_level,
			serverAccessLevel: pnid.server_access_level,
			mii: {
				name: pnid.mii.name,
				data: pnid.mii.data,
				url: `${config.cdn.base_url}/mii/${pnid.pid}/standard.tga`
			},
			creationDate: pnid.creation_date,
			birthdate: pnid.birthdate,
			gender: pnid.gender,
			country: pnid.country,
			language: pnid.language,
			emailAddress: pnid.email.address,
			tierName: pnid.connections.stripe.tier_name,
			permissions: {
				bannedAllPermanently: pnid.hasPermission(PNID_PERMISSION_FLAGS.BANNED_ALL_PERMANENTLY),
				bannedAllTemporarily: pnid.hasPermission(PNID_PERMISSION_FLAGS.BANNED_ALL_TEMPORARILY),
				betaAccess: pnid.hasPermission(PNID_PERMISSION_FLAGS.BETA_ACCESS),
				accessAdminPanel: pnid.hasPermission(PNID_PERMISSION_FLAGS.ACCESS_ADMIN_PANEL),
				createServerConfigs: pnid.hasPermission(PNID_PERMISSION_FLAGS.CREATE_SERVER_CONFIGS),
				modifyServerConfigs: pnid.hasPermission(PNID_PERMISSION_FLAGS.MODIFY_SERVER_CONFIGS),
				deployServer: pnid.hasPermission(PNID_PERMISSION_FLAGS.DEPLOY_SERVER),
				modifyPnids: pnid.hasPermission(PNID_PERMISSION_FLAGS.MODIFY_PNIDS),
				modifyNexAccounts: pnid.hasPermission(PNID_PERMISSION_FLAGS.MODIFY_NEX_ACCOUNTS),
				modifyConsoles: pnid.hasPermission(PNID_PERMISSION_FLAGS.MODIFY_CONSOLES),
				banPnids: pnid.hasPermission(PNID_PERMISSION_FLAGS.BAN_PNIDS),
				banNexAccounts: pnid.hasPermission(PNID_PERMISSION_FLAGS.BAN_NEX_ACCOUNTS),
				banConsoles: pnid.hasPermission(PNID_PERMISSION_FLAGS.BAN_CONSOLES),
				moderateMiiverse: pnid.hasPermission(PNID_PERMISSION_FLAGS.MODERATE_MIIVERSE),
				createApiKeys: pnid.hasPermission(PNID_PERMISSION_FLAGS.CREATE_API_KEYS),
				createBossTasks: pnid.hasPermission(PNID_PERMISSION_FLAGS.CREATE_BOSS_TASKS),
				updateBossTasks: pnid.hasPermission(PNID_PERMISSION_FLAGS.UPDATE_BOSS_TASKS),
				deleteBossTasks: pnid.hasPermission(PNID_PERMISSION_FLAGS.DELETE_BOSS_TASKS),
				uploadBossFiles: pnid.hasPermission(PNID_PERMISSION_FLAGS.UPLOAD_BOSS_FILES),
				updateBossFiles: pnid.hasPermission(PNID_PERMISSION_FLAGS.UPDATE_BOSS_FILES),
				deleteBossFiles: pnid.hasPermission(PNID_PERMISSION_FLAGS.DELETE_BOSS_FILES),
				updatePnidPermissions: pnid.hasPermission(PNID_PERMISSION_FLAGS.UPDATE_PNID_PERMISSIONS)
			},
			linkedDevices: devices
		},
		tokenInfo: {
			systemType: passwordResetToken.info.system_type as any, // TODO - Stop the any usage
			tokenType: passwordResetToken.info.system_type as any, // TODO - Stop the any usage
			pid: BigInt(pnid.pid),
			accessLevel: pnid.access_level,
			titleId: passwordResetToken.info.title_id,
			issueTime: passwordResetToken.info.issued,
			expireTime: passwordResetToken.info.expires
		}
	};
}
