import NintendoCertificate from '@/nintendo-certificate';
import { HydratedPNIDDocument } from '@/types/mongoose/pnid';
import { HydratedNEXAccountDocument } from '@/types/mongoose/nex-account';
import { HydratedDeviceDocument } from '@/types/mongoose/device';

declare global {
	namespace Express {
		interface Request {
			pnid: HydratedPNIDDocument | null;
			nexAccount: HydratedNEXAccountDocument | null;
			isCemu?: boolean;
			files?: Record<string, any>;
			certificate?: NintendoCertificate;
			device?: HydratedDeviceDocument;
		}
	}
}