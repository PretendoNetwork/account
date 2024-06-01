import express from 'express';
import xmlbuilder from 'xmlbuilder';
import { getValueFromQueryString } from '@/util';
import { PNID } from '@/models/pnid';
import { config } from '@/config-manager';
import { YesNoBoolString } from '@/types/common/yes-no-bool-string';

const router = express.Router();

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/miis
 * Description: Returns a list of NNID miis
 */
router.get('/', async (request: express.Request, response: express.Response): Promise<void> => {
	const input = getValueFromQueryString(request.query, 'pids');

	if (!input) {
		response.status(400).send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'Bad Request',
					code: '1600',
					message: 'Unable to process request'
				}
			}
		}).end());

		return;
	}

	const pids = input.split(',').map(pid => Number(pid)).filter(pid => !isNaN(pid));

	const miis: {
		data: string;
		id: number;
		images: {
			image: {
				cached_url: string;
				id: number;
				url: string;
				type: string;
			}[]
		};
		name: string;
		pid: number;
		primary: YesNoBoolString;
		user_id: string;
	}[] = [];

	for (const pid of pids) {
		// TODO - Replace this with a single query again somehow? Maybe aggregation?
		const pnid = await PNID.findOne({ pid });

		if (pnid) {
			miis.push({
				data: pnid.mii.data.replace(/(\r\n|\n|\r)/gm, ''),
				id: pnid.mii.id,
				images: {
					image: [
						{
							cached_url: `${config.cdn.base_url}/mii/${pnid.pid}/normal_face.png`,
							id: pnid.mii.id,
							url: `${config.cdn.base_url}/mii/${pnid.pid}/normal_face.png`,
							type: 'standard'
						},
						{
							cached_url: `${config.cdn.base_url}/mii/${pnid.pid}/frustrated.png`,
							id: pnid.mii.id,
							url: `${config.cdn.base_url}/mii/${pnid.pid}/frustrated.png`,
							type: 'frustrated_face'
						},
						{
							cached_url: `${config.cdn.base_url}/mii/${pnid.pid}/smile_open_mouth.png`,
							id: pnid.mii.id,
							url: `${config.cdn.base_url}/mii/${pnid.pid}/smile_open_mouth.png`,
							type: 'happy_face'
						},
						{
							cached_url: `${config.cdn.base_url}/mii/${pnid.pid}/wink_left.png`,
							id: pnid.mii.id,
							url: `${config.cdn.base_url}/mii/${pnid.pid}/wink_left.png`,
							type: 'like_face'
						},
						{
							cached_url: `${config.cdn.base_url}/mii/${pnid.pid}/normal_face.png`,
							id: pnid.mii.id,
							url: `${config.cdn.base_url}/mii/${pnid.pid}/normal_face.png`,
							type: 'normal_face'
						},
						{
							cached_url: `${config.cdn.base_url}/mii/${pnid.pid}/sorrow.png`,
							id: pnid.mii.id,
							url: `${config.cdn.base_url}/mii/${pnid.pid}/sorrow.png`,
							type: 'puzzled_face'
						},
						{
							cached_url: `${config.cdn.base_url}/mii/${pnid.pid}/surprised_open_mouth.png`,
							id: pnid.mii.id,
							url: `${config.cdn.base_url}/mii/${pnid.pid}/surprised_open_mouth.png`,
							type: 'surprised_face'
						},
						{
							cached_url: `${config.cdn.base_url}/mii/${pnid.pid}/body.png`,
							id: pnid.mii.id,
							url: `${config.cdn.base_url}/mii/${pnid.pid}/body.png`,
							type: 'whole_body'
						}
					]
				},
				name: pnid.mii.name,
				pid: pnid.pid,
				primary: pnid.mii.primary ? 'Y' : 'N',
				user_id: pnid.username
			});
		}
	}

	if (miis.length === 0) {
		response.status(404).end();
	} else {
		response.send(xmlbuilder.create({
			miis: {
				mii: miis
			}
		}).end());
	}
});

export default router;
