import type NintendoCertificate from '@/nintendo-certificate';
import type { HydratedPNIDDocument } from '@/types/mongoose/pnid';
import type { HydratedNEXAccountDocument } from '@/types/mongoose/nex-account';
import type { HydratedDeviceDocument } from '@/types/mongoose/device';

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
