import { Status, ServerError } from 'nice-grpc';
import { UpdatePNIDPermissionsRequest } from '@pretendonetwork/grpc/account/update_pnid_permissions';
import { getPNIDByPID } from '@/database';
import { PNID_PERMISSION_FLAGS } from '@/types/common/permission-flags';
import type { Empty } from '@pretendonetwork/grpc/api/google/protobuf/empty';
import type { HydratedPNIDDocument } from '@/types/mongoose/pnid';

export async function updatePNIDPermissions(request: UpdatePNIDPermissionsRequest): Promise<Empty> {
	const pnid: HydratedPNIDDocument | null = await getPNIDByPID(request.pid);

	if (!pnid) {
		throw new ServerError(
			Status.INVALID_ARGUMENT,
			'No PNID found',
		);
	}

	if (!request.permissions) {
		throw new ServerError(
			Status.INVALID_ARGUMENT,
			'Permissions flags not found',
		);
	}

	if (request.permissions.bannedAllPermanently === true) {
		await pnid.addPermission(PNID_PERMISSION_FLAGS.BANNED_ALL_PERMANENTLY);
	} else if (request.permissions.bannedAllPermanently === false) {
		await pnid.clearPermission(PNID_PERMISSION_FLAGS.BANNED_ALL_PERMANENTLY);
	}

	if (request.permissions.bannedAllTemporarily === true) {
		await pnid.addPermission(PNID_PERMISSION_FLAGS.BANNED_ALL_TEMPORARILY);
	} else if (request.permissions.bannedAllTemporarily === false) {
		await pnid.clearPermission(PNID_PERMISSION_FLAGS.BANNED_ALL_TEMPORARILY);
	}

	if (request.permissions.betaAccess === true) {
		await pnid.addPermission(PNID_PERMISSION_FLAGS.BETA_ACCESS);
	} else if (request.permissions.betaAccess === false) {
		await pnid.clearPermission(PNID_PERMISSION_FLAGS.BETA_ACCESS);
	}

	if (request.permissions.accessAdminPanel === true) {
		await pnid.addPermission(PNID_PERMISSION_FLAGS.ACCESS_ADMIN_PANEL);
	} else if (request.permissions.accessAdminPanel === false) {
		await pnid.clearPermission(PNID_PERMISSION_FLAGS.ACCESS_ADMIN_PANEL);
	}

	if (request.permissions.createServerConfigs === true) {
		await pnid.addPermission(PNID_PERMISSION_FLAGS.CREATE_SERVER_CONFIGS);
	} else if (request.permissions.createServerConfigs === false) {
		await pnid.clearPermission(PNID_PERMISSION_FLAGS.CREATE_SERVER_CONFIGS);
	}

	if (request.permissions.modifyServerConfigs === true) {
		await pnid.addPermission(PNID_PERMISSION_FLAGS.MODIFY_SERVER_CONFIGS);
	} else if (request.permissions.modifyServerConfigs === false) {
		await pnid.clearPermission(PNID_PERMISSION_FLAGS.MODIFY_SERVER_CONFIGS);
	}

	if (request.permissions.deployServer === true) {
		await pnid.addPermission(PNID_PERMISSION_FLAGS.DEPLOY_SERVER);
	} else if (request.permissions.deployServer === false) {
		await pnid.clearPermission(PNID_PERMISSION_FLAGS.DEPLOY_SERVER);
	}

	if (request.permissions.modifyPnids === true) {
		await pnid.addPermission(PNID_PERMISSION_FLAGS.MODIFY_PNIDS);
	} else if (request.permissions.modifyPnids === false) {
		await pnid.clearPermission(PNID_PERMISSION_FLAGS.MODIFY_PNIDS);
	}

	if (request.permissions.modifyNexAccounts === true) {
		await pnid.addPermission(PNID_PERMISSION_FLAGS.MODIFY_NEX_ACCOUNTS);
	} else if (request.permissions.modifyNexAccounts === false) {
		await pnid.clearPermission(PNID_PERMISSION_FLAGS.MODIFY_NEX_ACCOUNTS);
	}

	if (request.permissions.modifyConsoles === true) {
		await pnid.addPermission(PNID_PERMISSION_FLAGS.MODIFY_CONSOLES);
	} else if (request.permissions.modifyConsoles === false) {
		await pnid.clearPermission(PNID_PERMISSION_FLAGS.MODIFY_CONSOLES);
	}

	if (request.permissions.banPnids === true) {
		await pnid.addPermission(PNID_PERMISSION_FLAGS.BAN_PNIDS);
	} else if (request.permissions.banPnids === false) {
		await pnid.clearPermission(PNID_PERMISSION_FLAGS.BAN_PNIDS);
	}

	if (request.permissions.banNexAccounts === true) {
		await pnid.addPermission(PNID_PERMISSION_FLAGS.BAN_NEX_ACCOUNTS);
	} else if (request.permissions.banNexAccounts === false) {
		await pnid.clearPermission(PNID_PERMISSION_FLAGS.BAN_NEX_ACCOUNTS);
	}

	if (request.permissions.banConsoles === true) {
		await pnid.addPermission(PNID_PERMISSION_FLAGS.BAN_CONSOLES);
	} else if (request.permissions.banConsoles === false) {
		await pnid.clearPermission(PNID_PERMISSION_FLAGS.BAN_CONSOLES);
	}

	if (request.permissions.moderateMiiverse === true) {
		await pnid.addPermission(PNID_PERMISSION_FLAGS.MODERATE_MIIVERSE);
	} else if (request.permissions.moderateMiiverse === false) {
		await pnid.clearPermission(PNID_PERMISSION_FLAGS.MODERATE_MIIVERSE);
	}

	if (request.permissions.createApiKeys === true) {
		await pnid.addPermission(PNID_PERMISSION_FLAGS.CREATE_API_KEYS);
	} else if (request.permissions.createApiKeys === false) {
		await pnid.clearPermission(PNID_PERMISSION_FLAGS.CREATE_API_KEYS);
	}

	if (request.permissions.createBossTasks === true) {
		await pnid.addPermission(PNID_PERMISSION_FLAGS.CREATE_BOSS_TASKS);
	} else if (request.permissions.createBossTasks === false) {
		await pnid.clearPermission(PNID_PERMISSION_FLAGS.CREATE_BOSS_TASKS);
	}

	if (request.permissions.updateBossTasks === true) {
		await pnid.addPermission(PNID_PERMISSION_FLAGS.UPDATE_BOSS_TASKS);
	} else if (request.permissions.updateBossTasks === false) {
		await pnid.clearPermission(PNID_PERMISSION_FLAGS.UPDATE_BOSS_TASKS);
	}

	if (request.permissions.deleteBossTasks === true) {
		await pnid.addPermission(PNID_PERMISSION_FLAGS.DELETE_BOSS_TASKS);
	} else if (request.permissions.deleteBossTasks === false) {
		await pnid.clearPermission(PNID_PERMISSION_FLAGS.DELETE_BOSS_TASKS);
	}

	if (request.permissions.uploadBossFiles === true) {
		await pnid.addPermission(PNID_PERMISSION_FLAGS.UPLOAD_BOSS_FILES);
	} else if (request.permissions.uploadBossFiles === false) {
		await pnid.clearPermission(PNID_PERMISSION_FLAGS.UPLOAD_BOSS_FILES);
	}

	if (request.permissions.updateBossFiles === true) {
		await pnid.addPermission(PNID_PERMISSION_FLAGS.UPDATE_BOSS_FILES);
	} else if (request.permissions.updateBossFiles === false) {
		await pnid.clearPermission(PNID_PERMISSION_FLAGS.UPDATE_BOSS_FILES);
	}

	if (request.permissions.deleteBossFiles === true) {
		await pnid.addPermission(PNID_PERMISSION_FLAGS.DELETE_BOSS_FILES);
	} else if (request.permissions.deleteBossFiles === false) {
		await pnid.clearPermission(PNID_PERMISSION_FLAGS.DELETE_BOSS_FILES);
	}

	if (request.permissions.updatePnidPermissions === true) {
		await pnid.addPermission(PNID_PERMISSION_FLAGS.UPDATE_PNID_PERMISSIONS);
	} else if (request.permissions.updatePnidPermissions === false) {
		await pnid.clearPermission(PNID_PERMISSION_FLAGS.UPDATE_PNID_PERMISSIONS);
	}

	await pnid.save();

	return {};
}