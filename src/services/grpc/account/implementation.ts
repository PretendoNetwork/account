import { AccountServiceImplementation } from '@pretendonetwork/grpc/account/account_service';
import { getUserData } from '@/services/grpc/account/get-user-data';
import { getNEXPassword } from '@/services/grpc/account/get-nex-password';
import { getNEXData } from '@/services/grpc/account/get-nex-data';
import { updatePNIDPermissions } from '@/services/grpc/account/update-pnid-permissions';
import { exchangeTokenForUserData } from '@/services/grpc/account/exchange-token-for-user-data';

export const accountServiceImplementation: AccountServiceImplementation = {
	getUserData,
	getNEXPassword,
	getNEXData,
	updatePNIDPermissions,
	exchangeTokenForUserData
};
