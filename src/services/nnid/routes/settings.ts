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
	response.setHeader('x-nintendo-whitelist', '1|http,mii.olv.pretendo.cc,,2|1|https,mii.olv.pretendo.cc,,2|1|http,cdn.olv.pretendo.cc,,2|1|https,cdn.olv.pretendo.cc,,2|1|https,kaeru.b-cdn.net,,2|1|https,cdn.jsdelivr.net,,2|1|http,kt-imogen.b-cdn.net,,2|1|http,youtube.com,,2|http,portal.cdn.pretendo.cc,,2|https,portal.cdn.pretendo.cc,,2|http,pretendo-cdn.b-cdn.net,,2|https,pretendo-cdn.b-cdn.net,,2|https,youtube.com,,2|http,.youtube.com,,2|https,.youtube.com,,2|http,.ytimg.com,,2|https,.ytimg.com,,2|http,.googlevideo.com,,2|https,.googlevideo.com,,2|https,youtube.com,/embed/,6|https,youtube.com,/e/,6|https,youtube.com,/v/,6|https,www.youtube.com,/embed/,6|https,www.youtube.com,/e/,6|https,www.youtube.com,/v/,6|https,youtube.googleapis.com,/e/,6|https,youtube.googleapis.com,/v/,6|http,maps.googleapis.com,/maps/api/streetview,2|https,maps.googleapis.com,/maps/api/streetview,2|http,cbk0.google.com,/cbk,2|https,cbk0.google.com,/cbk,2|http,cbk1.google.com,/cbk,2|https,cbk1.google.com,/cbk,2|http,cbk2.google.com,/cbk,2|https,cbk2.google.com,/cbk,2|http,cbk3.google.com,/cbk,2|https,cbk3.google.com,/cbk,2|https,.cloudfront.net,,2|https,www.google-analytics.com,/,2|https,stats.g.doubleclick.net,,2|https,www.google.com,/ads/,2|https,ssl.google-analytics.com,,2|http,fonts.googleapis.com,,2|fonts.googleapis.com,,2|https,www.googletagmanager.com,,2|http,miiverse.cc,,2|https,miiverse.cc,,2');

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

	response.render('index.ejs', {
		PNID
	});
});

export default router;
