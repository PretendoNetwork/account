import { getUserData } from '@/services/grpc/account/v2/get-user-data';
import { getNEXPassword } from '@/services/grpc/account/v2/get-nex-password';
import { getNEXData } from '@/services/grpc/account/v2/get-nex-data';
import { updatePNIDPermissions } from '@/services/grpc/account/v2/update-pnid-permissions';
import { exchangeTokenForUserData } from '@/services/grpc/account/v2/exchange-token-for-user-data';
import { exchangeOAuthTokenForUserData } from '@/services/grpc/account/v2/exchange-oauth-token-for-user-data';
import { exchangeNEXTokenForUserData } from '@/services/grpc/account/v2/exchange-nex-token-for-user-data';
import { exchangeIndependentServiceTokenForUserData } from '@/services/grpc/account/v2/exchange-independent-service-token-for-user-data';
import { exchangePasswordResetTokenForUserData } from '@/services/grpc/account/v2/exchange-password-reset-token-for-user-data';
import { validateIndependentServiceToken } from '@/services/grpc/account/v2/validate-independent-service-token';
import { deleteAccount } from '@/services/grpc/account/v2/delete-account';
import { listDevices } from '@/services/grpc/account/v2/list-devices';
import { getDevice } from '@/services/grpc/account/v2/get-device';
import { updateDevice } from '@/services/grpc/account/v2/update-device';
import { listNEXAccounts } from '@/services/grpc/account/v2/list-nex-accounts';
import { getNEXAccount } from '@/services/grpc/account/v2/get-nex-account';
import { updateNEXAccount } from '@/services/grpc/account/v2/update-nex-account';
import { listServers } from '@/services/grpc/account/v2/list-servers';
import { createServer } from '@/services/grpc/account/v2/create-server';
import { getServer } from '@/services/grpc/account/v2/get-server';
import { updateServer } from '@/services/grpc/account/v2/update-server';
import { deleteServer } from '@/services/grpc/account/v2/delete-server';
import { listPNIDs } from '@/services/grpc/account/v2/list-pnids';
import { getPNID } from '@/services/grpc/account/v2/get-pnid';
import { updatePNID } from '@/services/grpc/account/v2/update-pnid';
import { deletePNID } from '@/services/grpc/account/v2/delete-pnid';
import { listAuditLogs } from '@/services/grpc/account/v2/list-audit-logs';
import { listAuditLogComments } from '@/services/grpc/account/v2/list-audit-log-comments';
import { createAuditLogComment } from '@/services/grpc/account/v2/create-audit-log-comment';
import { listBans } from '@/services/grpc/account/v2/list-bans';
import { issueBan } from '@/services/grpc/account/v2/issue-ban';
import { getBan } from '@/services/grpc/account/v2/get-ban';
import { updateBan } from '@/services/grpc/account/v2/update-ban';
import { pardonBan } from '@/services/grpc/account/v2/pardon-ban';
import { listBanComments } from '@/services/grpc/account/v2/list-ban-comments';
import { createBanComment } from '@/services/grpc/account/v2/create-ban-comment';
import type { AccountServiceImplementation } from '@pretendonetwork/grpc/account/v2/account_service';

export const accountServiceImplementationV2: AccountServiceImplementation = {
	getUserData,
	getNEXPassword,
	getNEXData,
	updatePNIDPermissions,
	exchangeTokenForUserData,
	exchangeOAuthTokenForUserData,
	exchangeNEXTokenForUserData,
	exchangeIndependentServiceTokenForUserData,
	exchangePasswordResetTokenForUserData,
	validateIndependentServiceToken,
	deleteAccount,
	listDevices,
	getDevice,
	updateDevice,
	listNEXAccounts,
	getNEXAccount,
	updateNEXAccount,
	listServers,
	createServer,
	getServer,
	updateServer,
	deleteServer,
	listPNIDs,
	getPNID,
	updatePNID,
	deletePNID,
	listAuditLogs,
	listAuditLogComments,
	createAuditLogComment,
	listBans,
	issueBan,
	getBan,
	updateBan,
	pardonBan,
	listBanComments,
	createBanComment
};
