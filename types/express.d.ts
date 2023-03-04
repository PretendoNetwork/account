import { HydratedDocument } from 'mongoose';
import NintendoCertificate from '@nintendo-certificate';

declare global {
	namespace Express {
		interface Request {
			pnid?: HydratedDocument<IPNID, IPNIDMethods>;
			isCemu?: boolean;
			files?: Record<string, any>;
			certificate?: NintendoCertificate;
		}
	}
}