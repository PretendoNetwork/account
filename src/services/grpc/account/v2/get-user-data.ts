import { Status, ServerError } from 'nice-grpc';
import { getPNIDByPID } from '@/database';
import { PNID_PERMISSION_FLAGS } from '@/types/common/permission-flags';
import { config } from '@/config-manager';
import { Device } from '@/models/device';
import type { GetUserDataRequest, GetUserDataResponse } from '@pretendonetwork/grpc/account/v2/get_user_data_rpc';

export async function getUserData(request: GetUserDataRequest): Promise<GetUserDataResponse> {
	const pnid = await getPNIDByPID(request.pid);

	if (!pnid) {
		throw new ServerError(
			Status.INVALID_ARGUMENT,
			'No PNID found'
		);
	}

	const devices = (await Device.find({
		linked_pids: pnid.pid
	})).map((device) => {
		return {
			model: device.get('model'), // ".model" gives the Mongoose model...
			serial: device.serial,
			linkedPids: device.linked_pids,
			accessLevel: device.access_level,
			serverAccessLevel: device.server_access_level
		};
	});

	return {
		deleted: pnid.deleted || pnid.marked_for_deletion,
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
	};
}
