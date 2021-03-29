const router = require('express').Router();
const xmlbuilder = require('xmlbuilder');
const { PNID } = require('../../../models/pnid');
const clientHeaderCheck = require('../../../middleware/client-header');

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/miis
 * Description: Returns a list of NNID miis
 */
router.get('/', clientHeaderCheck, async (request, response) => {

	const { pids } = request.query;

	const results = await PNID.where('pid', pids);
	const miis = [];

	// We don't have a Mii renderer yet so hard code the images
	const hardCodedImages = [
		{
			cached_url: 'http://mii-images.cdn.nintendo.net/zcz5c1xf62bb_standard.png',
			id: 1292086302,
			url: 'http://mii-images.cdn.nintendo.net/zcz5c1xf62bb_standard.png',
			type: 'standard'
		},
		{
			cached_url: 'http://mii-images.cdn.nintendo.net/zcz5c1xf62bb_frustrated_face.png',
			id: 1292086302,
			url: 'http://mii-images.cdn.nintendo.net/zcz5c1xf62bb_frustrated_face.png',
			type: 'frustrated_face'
		},
		{
			cached_url: 'http://mii-images.cdn.nintendo.net/zcz5c1xf62bb_happy_face.png',
			id: 1292086302,
			url: 'http://mii-images.cdn.nintendo.net/zcz5c1xf62bb_happy_face.png',
			type: 'happy_face'
		},
		{
			cached_url: 'http://mii-images.cdn.nintendo.net/zcz5c1xf62bb_like_face.png',
			id: 1292086302,
			url: 'http://mii-images.cdn.nintendo.net/zcz5c1xf62bb_like_face.png',
			type: 'like_face'
		},
		{
			cached_url: 'http://mii-images.cdn.nintendo.net/zcz5c1xf62bb_normal_face.png',
			id: 1292086302,
			url: 'http://mii-images.cdn.nintendo.net/zcz5c1xf62bb_normal_face.png',
			type: 'normal_face'
		},
		{
			cached_url: 'http://mii-images.cdn.nintendo.net/zcz5c1xf62bb_puzzled_face.png',
			id: 1292086302,
			url: 'http://mii-images.cdn.nintendo.net/zcz5c1xf62bb_puzzled_face.png',
			type: 'puzzled_face'
		},
		{
			cached_url: 'http://mii-images.cdn.nintendo.net/zcz5c1xf62bb_surprised_face.png',
			id: 1292086302,
			url: 'http://mii-images.cdn.nintendo.net/zcz5c1xf62bb_surprised_face.png',
			type: 'surprised_face'
		},
		{
			cached_url: 'http://mii-images.cdn.nintendo.net/zcz5c1xf62bb_whole_body.png',
			id: 1292086302,
			url: 'http://mii-images.cdn.nintendo.net/zcz5c1xf62bb_whole_body.png',
			type: 'whole_body'
		}
	];

	for (const user of results) {
		const  { mii } = user;

		miis.push({
			data: mii.data.replace(/(\r\n|\n|\r)/gm, ''),
			id: mii.id,
			images: {
				image: hardCodedImages
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