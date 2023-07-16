import { AccountServiceImplementation } from 'pretendo-grpc-ts/dist/account/account_service';
import { getUserData } from '@/services/grpc/account/get-user-data';
import { getNEXPassword } from '@/services/grpc/account/get-nex-password';
import { getNEXData } from '@/services/grpc/account/get-nex-data';

export const accountServiceImplementation: AccountServiceImplementation = {
	getUserData,
	getNEXPassword,
	getNEXData
};
