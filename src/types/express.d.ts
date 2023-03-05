import { HydratedDocument } from 'mongoose';
import NintendoCertificate from '@/nintendo-certificate';
import { IPNID, IPNIDMethods } from '@/types/mongoose/pnid';
import { INEXAccount, INEXAccountMethods } from '@/types/mongoose/nex-account';

declare global {
	namespace Express {
		interface Request {
			pnid?: HydratedDocument<IPNID, IPNIDMethods>;
			nexUser?: HydratedDocument<INEXAccount, INEXAccountMethods>;
			isCemu?: boolean;
			files?: Record<string, any>;
			certificate?: NintendoCertificate;
		}
	}
}