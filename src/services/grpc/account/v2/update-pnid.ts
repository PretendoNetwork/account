import crypto from 'node:crypto';
import { Status, ServerError } from 'nice-grpc';
import validator from 'validator';
import Mii from 'mii-js';
import { AuditLogActionType } from '@pretendonetwork/grpc/account/v2/audit_log_action_type';
import { connection as databaseConnection } from '@/database';
import { LOG_ERROR } from '@/logger';
import { AuditLog } from '@/models/audit-log';
import { PNID } from '@/models/pnid';
import { ALLOWED_ACCOUNT_COUNTRIES, ALLOWED_ACCOUNT_LANGUAGES } from '@/services/nnas/account-constants';
import { getExecutorPNID } from '@/services/grpc/account/v2/utils';
import { isValidBirthday, sendConfirmationEmail } from '@/util';
import { PNID_PERMISSION_FLAGS } from '@/types/common/permission-flags';
import type { CallContext } from 'nice-grpc';
import type { UpdatePNIDRequest, UpdatePNIDResponse } from '@pretendonetwork/grpc/account/v2/update_pnid_rpc';
import type { PNIDPermissionFlags } from '@pretendonetwork/grpc/account/v2/pnid_permission_flags';
import type { PNIDPermissionFlag } from '@/types/common/permission-flags';
import type { HydratedPNIDDocument } from '@/types/mongoose/pnid';

const SERVER_ACCESS_LEVELS = [
	'prod',
	'test',
	'dev'
];
const GENDERS = [
	'M',
	'F'
];

// * -1: banned, 0: standard, 1: tester, 2: mod?, 3: dev
const MIN_ACCESS_LEVEL = -1;
const MAX_ACCESS_LEVEL = 3;

// * Quick lookup map because lazy
const PERMISSION_FLAGS: Record<keyof PNIDPermissionFlags, PNIDPermissionFlag> = {
	bannedAllPermanently: PNID_PERMISSION_FLAGS.BANNED_ALL_PERMANENTLY,
	bannedAllTemporarily: PNID_PERMISSION_FLAGS.BANNED_ALL_TEMPORARILY,
	betaAccess: PNID_PERMISSION_FLAGS.BETA_ACCESS,
	accessAdminPanel: PNID_PERMISSION_FLAGS.ACCESS_ADMIN_PANEL,
	createServerConfigs: PNID_PERMISSION_FLAGS.CREATE_SERVER_CONFIGS,
	modifyServerConfigs: PNID_PERMISSION_FLAGS.MODIFY_SERVER_CONFIGS,
	deployServer: PNID_PERMISSION_FLAGS.DEPLOY_SERVER,
	modifyPnids: PNID_PERMISSION_FLAGS.MODIFY_PNIDS,
	modifyNexAccounts: PNID_PERMISSION_FLAGS.MODIFY_NEX_ACCOUNTS,
	modifyConsoles: PNID_PERMISSION_FLAGS.MODIFY_CONSOLES,
	banPnids: PNID_PERMISSION_FLAGS.BAN_PNIDS,
	banNexAccounts: PNID_PERMISSION_FLAGS.BAN_NEX_ACCOUNTS,
	banConsoles: PNID_PERMISSION_FLAGS.BAN_CONSOLES,
	moderateMiiverse: PNID_PERMISSION_FLAGS.MODERATE_MIIVERSE,
	createApiKeys: PNID_PERMISSION_FLAGS.CREATE_API_KEYS,
	createBossTasks: PNID_PERMISSION_FLAGS.CREATE_BOSS_TASKS,
	updateBossTasks: PNID_PERMISSION_FLAGS.UPDATE_BOSS_TASKS,
	deleteBossTasks: PNID_PERMISSION_FLAGS.DELETE_BOSS_TASKS,
	uploadBossFiles: PNID_PERMISSION_FLAGS.UPLOAD_BOSS_FILES,
	updateBossFiles: PNID_PERMISSION_FLAGS.UPDATE_BOSS_FILES,
	deleteBossFiles: PNID_PERMISSION_FLAGS.DELETE_BOSS_FILES,
	updatePnidPermissions: PNID_PERMISSION_FLAGS.UPDATE_PNID_PERMISSIONS
};

const IGNORED_AUDIT_LOG_PATHS = [
	'identification',
	'email.history'
];

export async function updatePNID(request: UpdatePNIDRequest, context: CallContext): Promise<UpdatePNIDResponse> {
	const executor = await getExecutorPNID(context, PNID_PERMISSION_FLAGS.MODIFY_PNIDS);

	if (request.permissions !== undefined && !executor.hasPermission(PNID_PERMISSION_FLAGS.UPDATE_PNID_PERMISSIONS)) {
		throw new ServerError(Status.PERMISSION_DENIED, 'Executor PNID lacks the required permission');
	}

	if (request.pid === 0) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid PNID PID');
	}

	const accessLevel = request.accessLevel;
	const serverAccessLevel = request.serverAccessLevel?.trim();
	const mii = request.mii?.data.trim();
	const birthdate = request.birthdate?.trim();
	const gender = request.gender?.trim();
	const country = request.country?.trim();
	const language = request.language?.trim();
	const emailAddress = request.emailAddress?.trim().toLowerCase();
	const permissions = request.permissions;

	const session = await databaseConnection().startSession();
	let pnid: HydratedPNIDDocument | null;
	let emailChanged = false;

	try {
		session.startTransaction();

		pnid = await PNID.findOne({
			pid: request.pid
		}).session(session);

		if (!pnid) {
			throw new ServerError(Status.NOT_FOUND, 'PNID not found');
		}

		if (pnid.deleted) {
			throw new ServerError(Status.FAILED_PRECONDITION, 'PNID has been deleted');
		}

		const oldPNID = PNID.hydrate(pnid.toObject());

		if (accessLevel !== undefined) {
			if (!Number.isInteger(accessLevel) || accessLevel < MIN_ACCESS_LEVEL || accessLevel > MAX_ACCESS_LEVEL) {
				throw new ServerError(Status.INVALID_ARGUMENT, `Access level must be between ${MIN_ACCESS_LEVEL} and ${MAX_ACCESS_LEVEL}`);
			}

			pnid.access_level = accessLevel;
		}

		if (serverAccessLevel !== undefined) {
			if (!SERVER_ACCESS_LEVELS.includes(serverAccessLevel)) {
				throw new ServerError(Status.INVALID_ARGUMENT, `Server access level must be one of ${SERVER_ACCESS_LEVELS.join(', ')}`);
			}

			pnid.server_access_level = serverAccessLevel;
		}

		if (birthdate !== undefined) {
			if (!isValidBirthday(birthdate)) {
				throw new ServerError(Status.INVALID_ARGUMENT, 'Birthdate must be a valid date formatted as YYYY-MM-DD');
			}

			pnid.birthdate = birthdate;
		}

		if (gender !== undefined) {
			if (!GENDERS.includes(gender)) {
				throw new ServerError(Status.INVALID_ARGUMENT, `Gender must be one of ${GENDERS.join(', ')}`);
			}

			pnid.gender = gender;
		}

		if (country !== undefined) {
			if (!ALLOWED_ACCOUNT_COUNTRIES.includes(country)) {
				throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid country');
			}

			pnid.country = country;
		}

		if (language !== undefined) {
			if (!ALLOWED_ACCOUNT_LANGUAGES.includes(language)) {
				throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid language');
			}

			pnid.language = language;
		}

		if (emailAddress !== undefined && emailAddress !== pnid.email.address) {
			if (!validator.isEmail(emailAddress)) {
				throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid email address');
			}

			pnid.email.history.unshift({
				old: pnid.email.address,
				new: emailAddress,
				on: new Date()
			});

			pnid.email.address = emailAddress;
			pnid.email.reachable = false;
			pnid.email.validated = false;
			pnid.email.validated_date = '';
			pnid.email.id = crypto.randomBytes(4).readUInt32LE();

			await pnid.generateEmailValidationCode();
			await pnid.generateEmailValidationToken();

			emailChanged = true;
		}

		if (permissions !== undefined) {
			for (const [key, flag] of Object.entries(PERMISSION_FLAGS)) {
				if (permissions[key as keyof PNIDPermissionFlags]) {
					pnid.addPermission(flag);
				} else {
					pnid.clearPermission(flag);
				}
			}
		}

		if (mii !== undefined) {
			let parsedMii: Mii;

			try {
				parsedMii = new Mii(Buffer.from(mii, 'base64'));
				parsedMii.validate();
			} catch {
				throw new ServerError(Status.INVALID_ARGUMENT, 'Invalid Mii data');
			}

			const miiData = parsedMii.encode().toString('base64');

			if (miiData !== pnid.mii.data) {
				pnid.mii.name = parsedMii.miiName;
				pnid.mii.primary = true;
				pnid.mii.data = miiData;
				pnid.mii.hash = crypto.randomBytes(7).toString('hex');
				pnid.mii.id = crypto.randomBytes(4).readUInt32LE();
				pnid.mii.image_id = crypto.randomBytes(4).readUInt32LE();

				await pnid.generateMiiImages();
			}
		}

		const modifiedPaths = pnid.directModifiedPaths().filter(path => !IGNORED_AUDIT_LOG_PATHS.some(ignored => path.startsWith(ignored)));
		const changes: Record<string, {
			old: unknown;
			new: unknown;
		}> = {};

		for (const path of modifiedPaths) {
			const oldValue = oldPNID.get(path) ?? null;
			const newValue = pnid.get(path) ?? null;

			// * Mongoose marks reassigned fields as modified even if the value is the same
			if (JSON.stringify(oldValue, bigintReplacer) === JSON.stringify(newValue, bigintReplacer)) {
				continue;
			}

			changes[path] = {
				old: oldValue,
				new: newValue
			};
		}

		if (Object.keys(changes).length !== 0) {
			await pnid.save({
				session
			});

			await new AuditLog({
				action_type: AuditLogActionType.AUDIT_LOG_ACTION_TYPE_UPDATE_NETWORK_ACCOUNT,
				executed_by_pid: executor.pid,
				metadata: JSON.stringify({
					pid: pnid.pid,
					changes: changes
				}, bigintReplacer)
			}).save({
				session
			});
		}

		await session.commitTransaction();
	} catch (error) {
		await session.abortTransaction();

		if (error instanceof ServerError) {
			throw error;
		}

		LOG_ERROR(`[gRPC] /account.v2.AccountService/UpdatePNID: ${error instanceof Error ? error.message : error}`);

		throw new ServerError(Status.INTERNAL, 'Failed to update PNID');
	} finally {
		await session.endSession();
	}

	if (emailChanged) {
		try {
			await sendConfirmationEmail(pnid);
		} catch (error) {
			LOG_ERROR(`[gRPC] /account.v2.AccountService/UpdatePNID: Failed to send confirmation email to PNID ${pnid.pid}: ${error instanceof Error ? error.message : error}`);
		}
	}

	return {};
}

// * Permissions are stored as a bigint, which JSON.stringify cannot serialize
function bigintReplacer(_key: string, value: unknown): unknown {
	return typeof value === 'bigint' ? value.toString() : value;
}
