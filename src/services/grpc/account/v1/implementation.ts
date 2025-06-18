import { getUserData } from '@/services/grpc/account/v1/get-user-data';
import { getNEXPassword } from '@/services/grpc/account/v1/get-nex-password';
import { getNEXData } from '@/services/grpc/account/v1/get-nex-data';
import { updatePNIDPermissions } from '@/services/grpc/account/v1/update-pnid-permissions';
import { exchangeTokenForUserData } from '@/services/grpc/account/v1/exchange-token-for-user-data';

export const accountServiceImplementationV1 = {
	getUserData,
	getNEXPassword,
	getNEXData,
	updatePNIDPermissions,
	exchangeTokenForUserData
};
