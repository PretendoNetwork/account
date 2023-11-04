import express from 'express';
import { getServerByClientID, getPNIDByPID } from '@/database';
import { LOG_ERROR } from '@/logger';
import { HydratedServerDocument } from '@/types/mongoose/server';
import { HydratedPNIDDocument } from '@/types/mongoose/pnid';
import { decryptToken, unpackToken, getValueFromHeaders } from '@/util';
import { Token } from '@/types/common/token';

const router: express.Router = express.Router();

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/account-settings/ui/profile
 * Description: Serves the Nintendo Network ID Settings page for the Wii U
 */
router.get('/profile', async function (request: express.Request, response: express.Response): Promise<void> {
	const server: HydratedServerDocument | null = await getServerByClientID('3f3928cc6f780638d360f0485cef973f', 'prod');
	const token: string | undefined = getValueFromHeaders(request.headers, 'x-nintendo-service-token');
	if (!server || !token) {
		response.sendStatus(504);
		return;
	}
	const aes_key: string = server?.aes_key;
	const decryptedToken: Buffer = decryptToken(Buffer.from(token, 'base64'), aes_key);

	const tokenContents: Token = unpackToken(decryptedToken);

	try {
		const PNID: HydratedPNIDDocument | null = await getPNIDByPID(tokenContents.pid);

		if (!PNID) {
			response.sendStatus(504);
			return;
		}

		response.render('index.ejs', {
			PNID
		});
	}
	catch (error: any) {
		LOG_ERROR(error);
		response.sendStatus(504);
		return;
	}
});

export default router;
