import crypto from 'node:crypto';
import { Status, ServerError } from 'nice-grpc';
import { IndependentServiceToken } from '@/models/independent_service_token';
import { Device } from '@/models/device';
import { NEXAccount } from '@/models/nex-account';
import { getPNIDByPID } from '@/database';
import { PNID_PERMISSION_FLAGS } from '@/types/common/permission-flags';
import { config } from '@/config-manager';
import type { ExchangeIndependentServiceTokenForUserDataRequest, ExchangeIndependentServiceTokenForUserDataResponse } from '@pretendonetwork/grpc/account/v2/exchange_independent_service_token_for_user_data_rpc';
import type { HydratedPNIDDocument } from '@/types/mongoose/pnid';
import type { HydratedNEXAccountDocument } from '@/types/mongoose/nex-account';
import type { HydratedIndependentServiceTokenDocument } from '@/models/independent_service_token';

export async function exchangeIndependentServiceTokenForUserData(request: ExchangeIndependentServiceTokenForUserDataRequest): Promise<ExchangeIndependentServiceTokenForUserDataResponse> {
	let pnid: HydratedPNIDDocument | null = null;
	let nexAccount: HydratedNEXAccountDocument | null = null;
	let serviceToken: HydratedIndependentServiceTokenDocument | null = null;
	try {
		serviceToken = await IndependentServiceToken.findOne({
			token: crypto.createHash('sha256').update(request.token).digest('hex')
		});

		if (!serviceToken) {
			throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid token');
		}

		// TODO - Add checks for the client ID/title ID and matching system/token types here

		if (serviceToken.info.expires < new Date()) {
			throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid token');
		}

		pnid = await getPNIDByPID(serviceToken.pid);
		nexAccount = await NEXAccount.findOne({ pid: serviceToken.pid });
	} catch {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid token');
	}

	if (!nexAccount) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid token. No user found');
	}

	// TODO - Change this. This duplication sucks, but I wanna push this out the door
	if (pnid) {
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
			nexAccount: {
				pid: nexAccount.pid,
				owningPid: nexAccount.owning_pid,
				accessLevel: nexAccount.access_level,
				serverAccessLevel: nexAccount.server_access_level,
				friendCode: nexAccount.friend_code,
				deviceType: nexAccount.device_type
			},
			tokenInfo: {
				systemType: serviceToken.info.system_type as any, // TODO - Stop the any usage
				tokenType: serviceToken.info.system_type as any, // TODO - Stop the any usage
				pid: BigInt(pnid.pid),
				accessLevel: pnid.access_level,
				titleId: serviceToken.info.title_id,
				issueTime: serviceToken.info.issued,
				expireTime: serviceToken.info.expires
			}
		};
	} else {
		return {
			pnid: undefined, // * Throws an error if this is not explictly set?
			nexAccount: {
				pid: nexAccount.pid,
				owningPid: nexAccount.owning_pid,
				accessLevel: nexAccount.access_level,
				serverAccessLevel: nexAccount.server_access_level,
				friendCode: nexAccount.friend_code,
				deviceType: nexAccount.device_type
			},
			tokenInfo: {
				systemType: serviceToken.info.system_type as any, // TODO - Stop the any usage
				tokenType: serviceToken.info.system_type as any, // TODO - Stop the any usage
				pid: BigInt(nexAccount.pid),
				accessLevel: nexAccount.access_level,
				titleId: serviceToken.info.title_id,
				issueTime: serviceToken.info.issued,
				expireTime: serviceToken.info.expires
			}
		};
	}
}
