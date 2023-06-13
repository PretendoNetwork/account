import { AccountServiceImplementation } from 'pretendo-grpc-ts/dist/account/account_service';
import { getUserData } from '@/services/grpc/account/get-user-data';
import { getNEXPassword } from '@/services/grpc/account/get-nex-password';

export const accountServiceImplementation: AccountServiceImplementation = {
	getUserData,
	getNEXPassword
};