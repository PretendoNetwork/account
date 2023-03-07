import express from 'express';
import xmlbuilder from 'xmlbuilder';
import { PNID } from '@/models/pnid';
import { config } from '@/config-manager';
import { HydratedPNIDDocument } from '@/types/mongoose/pnid';
import { YesNoBoolString } from '@/types/common/yes-no-bool-string';

const router: express.Router = express.Router();

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/miis
 * Description: Returns a list of NNID miis
 */
router.get('/', async (request: express.Request, response: express.Response) => {
	let pids: number[];

	if (Array.isArray(request.query.pids)) {
		pids = request.query.pids.map(pid => Number(pid));
	} else {
		const input = request.query.pids as string;
		pids = input.split(',').map(pid => Number(pid));
	}

	const results: HydratedPNIDDocument[] = await PNID.where('pid', pids);
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

	for (const user of results) {
		const mii: {
			name: string;
			primary: boolean;
			data: string;
			id: number;
			hash: string;
			image_url: string;
			image_id: number;
		} = user.mii;

		miis.push({
			data: mii.data.replace(/(\r\n|\n|\r)/gm, ''),
			id: mii.id,
			images: {
				image: [
					{
						cached_url: `${config.cdn.base_url}/mii/${user.pid}/normal_face.png`,
						id: mii.id,
						url: `${config.cdn.base_url}/mii/${user.pid}/normal_face.png`,
						type: 'standard'
					},
					{
						cached_url: `${config.cdn.base_url}/mii/${user.pid}/frustrated.png`,
						id: mii.id,
						url: `${config.cdn.base_url}/mii/${user.pid}/frustrated.png`,
						type: 'frustrated_face'
					},
					{
						cached_url: `${config.cdn.base_url}/mii/${user.pid}/smile_open_mouth.png`,
						id: mii.id,
						url: `${config.cdn.base_url}/mii/${user.pid}/smile_open_mouth.png`,
						type: 'happy_face'
					},
					{
						cached_url: `${config.cdn.base_url}/mii/${user.pid}/wink_left.png`,
						id: mii.id,
						url: `${config.cdn.base_url}/mii/${user.pid}/wink_left.png`,
						type: 'like_face'
					},
					{
						cached_url: `${config.cdn.base_url}/mii/${user.pid}/normal_face.png`,
						id: mii.id,
						url: `${config.cdn.base_url}/mii/${user.pid}/normal_face.png`,
						type: 'normal_face'
					},
					{
						cached_url: `${config.cdn.base_url}/mii/${user.pid}/sorrow.png`,
						id: mii.id,
						url: `${config.cdn.base_url}/mii/${user.pid}/sorrow.png`,
						type: 'puzzled_face'
					},
					{
						cached_url: `${config.cdn.base_url}/mii/${user.pid}/surprised_open_mouth.png`,
						id: mii.id,
						url: `${config.cdn.base_url}/mii/${user.pid}/surprised_open_mouth.png`,
						type: 'surprised_face'
					},
					{
						cached_url: `${config.cdn.base_url}/mii/${user.pid}/body.png`,
						id: mii.id,
						url: `${config.cdn.base_url}/mii/${user.pid}/body.png`,
						type: 'whole_body'
					}
				]
			},
			name: mii.name,
			pid: user.pid,
			primary: mii.primary ? 'Y' : 'N',
			user_id: user.username
		});
	}

	//console.log(results[0].mii.data.replace(/(\r\n|\n|\r)/gm, ''));

	response.send(xmlbuilder.create({
		miis: {
			mii: miis
		}
	}).end());
});

export default router;