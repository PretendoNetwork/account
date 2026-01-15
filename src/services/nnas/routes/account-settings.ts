import crypto from 'node:crypto';
import express from 'express';
import got from 'got';
import { z } from 'zod';
import { getServerByClientID, getPNIDByPID } from '@/database';
import { LOG_ERROR } from '@/logger';
import { getValueFromHeaders, sendConfirmationEmail } from '@/util';
import { config } from '@/config-manager';
import { IndependentServiceToken } from '@/models/independent_service_token';
import timezones from '@/services/nnas/timezones.json';
import regionsList from '@/services/nnas/regions.json';
import type { HydratedServerDocument } from '@/types/mongoose/server';
import type { HydratedPNIDDocument } from '@/types/mongoose/pnid';
import type { AccountSettings } from '@/types/services/nnas/account-settings';
import type { RegionLanguages } from '@/types/services/nnas/region-languages';
import type { RegionTimezone, RegionTimezones } from '@/types/services/nnas/region-timezones';
import type { Country, Region } from '@/types/services/nnas/regions';

const router = express.Router();

const accountSettingsSchema = z.object({
	birthdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	gender: z.enum(['M', 'F']),
	tz_name: z.string(),
	region: z.coerce.number(),
	country: z.string(),
	email: z.string().email(),
	server_selection: z.enum(['prod', 'test', 'dev']),
	marketing_flag: z.enum(['true', 'false']).transform(value => value === 'true'),
	off_device_flag: z.enum(['true', 'false']).transform(value => value === 'true')
});

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/account-settings/ui/profile
 * Description: Serves the Nintendo Network ID Settings page for the Wii U
 */
router.get('/ui/profile', async function (request: express.Request, response: express.Response): Promise<void> {
	const server: HydratedServerDocument | null = await getServerByClientID('3f3928cc6f780638d360f0485cef973f', config.server_environment);
	const token = getValueFromHeaders(request.headers, 'x-nintendo-service-token');

	if (!server || !token) {
		response.sendStatus(504);
		return;
	}

	const serviceToken = await IndependentServiceToken.findOne({
		token: crypto.createHash('sha256').update(token).digest('hex')
	});

	if (!serviceToken) {
		response.sendStatus(504);
		return;
	}

	if (serviceToken.client_id !== '3f3928cc6f780638d360f0485cef973f') {
		response.sendStatus(504);
		return;
	}

	try {
		const PNID: HydratedPNIDDocument | null = await getPNIDByPID(serviceToken.pid);

		if (!PNID) {
			response.sendStatus(504);
			return;
		}

		const countryCode = PNID.country;
		const language = PNID.language;

		const regionLanguages: RegionLanguages = timezones[countryCode as keyof typeof timezones];
		const regionTimezones: RegionTimezones = regionLanguages[language] ? regionLanguages[language] : Object.values(regionLanguages)[0];

		const region: Country | undefined = regionsList.find(region => region.iso_code === countryCode);

		const miiFaces = ['normal_face', 'smile_open_mouth', 'sorrow', 'surprise_open_mouth', 'wink_left', 'frustrated'];
		const face = miiFaces[crypto.randomInt(5)];

		const notice = request.query.notice ? request.query.notice.toString() : undefined;

		const accountLevel = ['Standard', 'Tester', 'Moderator', 'Developer'];

		response.render('index.ejs', {
			PNID,
			regionTimezones,
			face,
			notice,
			accountLevel,
			regions: region ? region.regions : [],
			regionsList
		});
	} catch (error: any) {
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

	try {
		const url = `${config.cdn.base_url}/mii/${request.params.pid}/${request.params.face}.png`;
		console.log(url);
		const miiImage = await got(url).buffer();

		response.set('Content-Type', 'image/png');
		response.send(miiImage);
	} catch (error: any) {
		LOG_ERROR(error);
		response.sendStatus(404);
		return;
	}
});

/**
 * [POST]
 * Description: Endpoint to update the PNID from the account settings app on the Wii
 */
router.post('/update', async function (request: express.Request, response: express.Response): Promise<void> {
	const server: HydratedServerDocument | null = await getServerByClientID('3f3928cc6f780638d360f0485cef973f', config.server_environment);
	const token = getValueFromHeaders(request.headers, 'x-nintendo-service-token');

	if (!server || !token) {
		response.sendStatus(504);
		return;
	}

	const serviceToken = await IndependentServiceToken.findOne({
		token: crypto.createHash('sha256').update(token).digest('hex')
	});

	if (!serviceToken) {
		response.sendStatus(504);
		return;
	}

	if (serviceToken.client_id !== '3f3928cc6f780638d360f0485cef973f') {
		response.sendStatus(504);
		return;
	}

	try {
		const pnid: HydratedPNIDDocument | null = await getPNIDByPID(serviceToken.pid);
		const personBody: AccountSettings = request.body;

		if (!pnid) {
			response.status(404);
			response.redirect('/v1/account-settings/ui/profile');
			return;
		}

		const person = accountSettingsSchema.safeParse(personBody);

		if (!person.success) {
			response.status(404);
			response.redirect('/v1/account-settings/ui/profile');
			return;
		}

		const timezoneName = (person.data.tz_name && !!Object.keys(person.data.tz_name).length) ? person.data.tz_name : pnid.timezone.name;

		const regionLanguages: RegionLanguages = timezones[pnid.country as keyof typeof timezones];
		const regionTimezones: RegionTimezones = regionLanguages[pnid.language] ? regionLanguages[pnid.language] : Object.values(regionLanguages)[0];
		const timezone: RegionTimezone | undefined = regionTimezones.find(tz => tz.area === timezoneName);
		const country: Country | undefined = regionsList.find(region => region.iso_code === pnid.country);
		let notice = '';

		if (!country) {
			response.status(404);
			response.redirect('/v1/account-settings/ui/profile');
			return;
		}

		const regionObject: Region | undefined = country.regions.find(region => region.id === person.data.region);
		const region = regionObject ? regionObject.id : pnid.region;

		if (!timezone) {
			response.status(404);
			response.redirect('/v1/account-settings/ui/profile');
			return;
		}

		pnid.birthdate = person.data.birthdate;
		pnid.gender = person.data.gender;
		pnid.region = region;
		pnid.country = person.data.country;
		pnid.timezone.name = timezoneName;
		pnid.timezone.offset = Number(timezone.utc_offset);
		pnid.flags.marketing = person.data.marketing_flag;
		pnid.flags.off_device = person.data.off_device_flag;

		if (person.data.server_selection && pnid.access_level > 0 && pnid.access_level < 4) {
			const environment = person.data.server_selection;

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

		if (person.data.email.trim().toLowerCase() !== pnid.email.address) {
			// TODO - Better email check
			pnid.email.address = person.data.email.trim().toLowerCase();
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
