import { getUserData } from '@/services/grpc/account/v2/get-user-data';
import { getNEXPassword } from '@/services/grpc/account/v2/get-nex-password';
import { getNEXData } from '@/services/grpc/account/v2/get-nex-data';
import { updatePNIDPermissions } from '@/services/grpc/account/v2/update-pnid-permissions';
import { exchangeTokenForUserData } from '@/services/grpc/account/v2/exchange-token-for-user-data';
import { deleteAccount } from '@/services/grpc/account/v2/delete-account';

export const accountServiceImplementationV2 = {
	getUserData,
	getNEXPassword,
	getNEXData,
	updatePNIDPermissions,
	exchangeTokenForUserData,
	deleteAccount
};
