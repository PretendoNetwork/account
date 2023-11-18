import crypto from 'node:crypto';
import express from 'express';
import got from 'got';
import { getServerByClientID, getPNIDByPID } from '@/database';
import { LOG_ERROR } from '@/logger';
import { decryptToken, unpackToken, getValueFromHeaders, sendConfirmationEmail } from '@/util';
import { config } from '@/config-manager';
import { HydratedServerDocument } from '@/types/mongoose/server';
import { HydratedPNIDDocument } from '@/types/mongoose/pnid';
import { AccountSettings } from '@/types/services/nnid/account-settings';
import { Token } from '@/types/common/token';
import { RegionLanguages } from '@/types/services/nnid/region-languages';
import { RegionTimezone, RegionTimezones } from '@/types/services/nnid/region-timezones';
import { Regions } from '@/types/services/nnid/regions';
import timezones from '@/services/nnid/timezones.json';
import regionsList from '@/services/nnid/regions.json';

const router: express.Router = express.Router();

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/account-settings/ui/profile
 * Description: Serves the Nintendo Network ID Settings page for the Wii U
 */
router.get('/ui/profile', async function (request: express.Request, response: express.Response): Promise<void> {
	const server: HydratedServerDocument | null = await getServerByClientID('3f3928cc6f780638d360f0485cef973f', config.server_environment);
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

		const countryCode: string = PNID.country;
		const language: string = PNID.language;

		const regionLanguages: RegionLanguages = timezones[countryCode as keyof typeof timezones];
		const regionTimezones: RegionTimezones = regionLanguages[language] ? regionLanguages[language] : Object.values(regionLanguages)[0];

		const region: Regions | undefined = regionsList.find((region) => region.iso_code === countryCode);

		const miiFaces = ['normal_face', 'smile_open_mouth', 'sorrow', 'surprise_open_mouth', 'wink_left', 'frustrated'];
		const face = miiFaces[crypto.randomInt(5)];

		const notice: string | undefined = request.query.notice ? request.query.notice.toString() : undefined;

		const accountLevel: string[] = ['Standard', 'Tester', 'Moderator', 'Developer'];

		response.render('index.ejs', {
			PNID,
			regionTimezones,
			face,
			notice,
			accountLevel,
			regions: region ? region.regions: []
		});
	}
	catch (error: any) {
		LOG_ERROR(error);
		response.sendStatus(504);
		return;
	}
});

/**
 * [GET]
 * Description: Fetches the requested mii image from the CDN and send it to the client.
 * This is required because of the strict domain whitelist in the account settings app
 * on the Wii U.
 */
router.get('/mii/:pid/:face', async function (request: express.Request, response: express.Response): Promise<void> {
	if (!config.cdn.base_url) {
		response.sendStatus(404);
		return;
	}
	const miiImage: Buffer = await got(`${config.cdn.base_url}/mii/${request.params.pid}/${request.params.face}.png`).buffer();
	response.set('Content-Type', 'image/png');
	response.send(miiImage);
});

/**
 * [POST]
 * Description: Endpoint to update the PNID from the account settings app on the Wii
 */
router.post('/update', async function (request: express.Request, response: express.Response): Promise<void> {
	const server: HydratedServerDocument | null = await getServerByClientID('3f3928cc6f780638d360f0485cef973f', config.server_environment);
	const token: string | undefined = getValueFromHeaders(request.headers, 'x-nintendo-service-token');
	if (!server || !token) {
		response.sendStatus(504);
		return;
	}

	const aesKey: string = server?.aes_key;
	const decryptedToken: Buffer = decryptToken(Buffer.from(token, 'base64'), aesKey);

	const tokenContents: Token = unpackToken(decryptedToken);

	try {
		const pnid: HydratedPNIDDocument | null = await getPNIDByPID(tokenContents.pid);
		const person: AccountSettings = request.body;

		if (!pnid) {
			response.status(404);
			response.redirect('/v1/account-settings/ui/profile');
			return;
		}

		const gender: string = person.gender ? person.gender : pnid.gender;
		const timezoneName: string = (person.tz_name && !!Object.keys(person.tz_name).length) ? person.tz_name : pnid.timezone.name;
		const marketingFlag: boolean = person.marketing_flag ? person.marketing_flag : pnid.flags.marketing;
		const offDeviceFlag: boolean = person.off_device_flag ? person.off_device_flag: pnid.flags.off_device;

		const regionLanguages: RegionLanguages = timezones[pnid.country as keyof typeof timezones];
		const regionTimezones: RegionTimezones = regionLanguages[pnid.language] ? regionLanguages[pnid.language] : Object.values(regionLanguages)[0];
		const timezone: RegionTimezone | undefined = regionTimezones.find(tz => tz.area === timezoneName);
		const region: number = person.region ? person.region: pnid.region;
		let notice: string = '';

		if (!timezone) {
			response.status(404);
			response.redirect('/v1/account-settings/ui/profile');
			return;
		}

		pnid.gender = gender;
		pnid.region = region;
		pnid.timezone.name = timezoneName;
		pnid.timezone.offset = Number(timezone.utc_offset);
		pnid.flags.marketing = marketingFlag;
		pnid.flags.off_device = offDeviceFlag;

		if (person.server_selection) {
			const environment: string = person.server_selection;

			if (environment === 'test' && pnid.access_level < 1) {
				response.status(400);
				notice = 'Do not have permission to enter this environment';
				response.redirect(`/v1/account-settings/ui/profile?notice=${notice}`);
				return;
			}

			if (environment === 'dev' && pnid.access_level < 3) {
				response.status(400);
				notice = 'Do not have permission to enter this environment';
				response.redirect(`/v1/account-settings/ui/profile?notice=${notice}`);
				return;
			}

			pnid.server_access_level = environment;
		}

		if (person.email.trim().toLowerCase() !== pnid.email.address) {
			// TODO - Better email check
			pnid.email.address = person.email.trim().toLowerCase();
			pnid.email.reachable = false;
			pnid.email.validated = false;
			pnid.email.validated_date = '';
			pnid.email.id = crypto.randomBytes(4).readUInt32LE();

			await pnid.generateEmailValidationCode();
			await pnid.generateEmailValidationToken();
			await sendConfirmationEmail(pnid);

			notice = 'A confirmation email has been sent to your inbox.';
		}

		await pnid.save();
		response.redirect(`/v1/account-settings/ui/profile?notice=${notice}`);
	} catch (error: any) {
		LOG_ERROR(error);
		response.sendStatus(504);
		return;
	}
});

export default router;
