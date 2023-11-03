import express from 'express';
import { getServerByClientID, getPNIDByPID } from '@/database';
import { HydratedServerDocument } from '@/types/mongoose/server';
import { HydratedPNIDDocument } from '@/types/mongoose/pnid';
import { decryptToken, unpackToken, getValueFromHeaders } from '@/util';
import { Token } from '@/types/common/token';
//import { GetUserDataResponse } from 'pretendo-grpc-ts/dist/account/get_user_data_rpc';
//import { getUserAccountData } from '@/util';

const router: express.Router = express.Router();

/* GET discovery server. */
router.get('/profile', async function (request: express.Request, response: express.Response): Promise<void> {
	const server: HydratedServerDocument | null = await getServerByClientID('3f3928cc6f780638d360f0485cef973f', 'prod');
	const token: string | undefined = getValueFromHeaders(request.headers, 'x-nintendo-service-token');
	if(!server || !token) {
		response.sendStatus(504);
		return;
	}
	const aes_key: string = server?.aes_key;
	const decryptedToken: Buffer = decryptToken(Buffer.from(token, 'base64'), aes_key);

	if(!decryptedToken) {
		response.sendStatus(504);
		return;
	}
	const tokenContents: Token = unpackToken(decryptedToken);
	const PNID: HydratedPNIDDocument | null = await getPNIDByPID(tokenContents.pid);

	if(!PNID) {
		response.sendStatus(504);
		return;
	}

	console.log(PNID);
	response.render('index.ejs', {
		PNID
	});
});

export default router;
