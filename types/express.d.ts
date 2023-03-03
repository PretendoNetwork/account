import NintendoCertificate from '../src/nintendo-certificate'

declare global {
	namespace Express {
		interface Request {
			pnid?: IPNID;
			isCemu?: boolean;
			files?: Record<string, any>;
			certificate?: NintendoCertificate;
		}
	}
}