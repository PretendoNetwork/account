import { AccountServiceImplementation } from 'pretendo-grpc-ts/dist/account/account_service';
import { getUserData } from '@/services/grpc/account/get-user-data';

export const accountServiceImplementation: AccountServiceImplementation = {
	getUserData,
};