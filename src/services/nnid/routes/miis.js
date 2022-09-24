const router = require('express').Router();
const xmlbuilder = require('xmlbuilder');
const { PNID } = require('../../../models/pnid');
const config = require('../../../config.json');

/**
 * [GET]
 * Replacement for: https://account.pretendo.cc/v1/api/miis
 * Description: Returns a list of NNID miis
 */
router.get('/', async (request, response) => {

	const { pids } = request.query;

	const results = await PNID.where('pid', pids);
	const miis = [];

	for (const user of results) {
		const  { mii } = user;

		const miiImages = [
			{
				cached_url: `${config.cdn_base}/mii/${user.pid}/normal_face.png`,
				id: mii.id,
				url: `${config.cdn_base}/mii/${user.pid}/normal_face.png`,
				type: 'standard'
			},
			{
				cached_url: `${config.cdn_base}/mii/${user.pid}/frustrated.png`,
				id: mii.id,
				url: `${config.cdn_base}/mii/${user.pid}/frustrated.png`,
				type: 'frustrated_face'
			},
			{
				cached_url: `${config.cdn_base}/mii/${user.pid}/smile_open_mouth.png`,
				id: mii.id,
				url: `${config.cdn_base}/mii/${user.pid}/smile_open_mouth.png`,
				type: 'happy_face'
			},
			{
				cached_url: `${config.cdn_base}/mii/${user.pid}/wink_left.png`,
				id: mii.id,
				url: `${config.cdn_base}/mii/${user.pid}/wink_left.png`,
				type: 'like_face'
			},
			{
				cached_url: `${config.cdn_base}/mii/${user.pid}/normal_face.png`,
				id: mii.id,
				url: `${config.cdn_base}/mii/${user.pid}/normal_face.png`,
				type: 'normal_face'
			},
			{
				cached_url: `${config.cdn_base}/mii/${user.pid}/sorrow.png`,
				id: mii.id,
				url: `${config.cdn_base}/mii/${user.pid}/sorrow.png`,
				type: 'puzzled_face'
			},
			{
				cached_url: `${config.cdn_base}/mii/${user.pid}/surprised_open_mouth.png`,
				id: mii.id,
				url: `${config.cdn_base}/mii/${user.pid}/surprised_open_mouth.png`,
				type: 'surprised_face'
			},
			{
				cached_url: `${config.cdn_base}/mii/${user.pid}/body.png`,
				id: mii.id,
				url: `${config.cdn_base}/mii/${user.pid}/body.png`,
				type: 'whole_body'
			}
		];

		miis.push({
			data: mii.data.replace(/(\r\n|\n|\r)/gm, ''),
			id: mii.id,
			images: {
				image: miiImages
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

module.exports = router;