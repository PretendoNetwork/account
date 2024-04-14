import express from 'express';
import xmlbuilder from 'xmlbuilder';
import timezones from '@/services/nnas/timezones.json';

const router = express.Router();

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/content/agreements/TYPE/REGION/VERSION
 * Description: Sends the client requested agreement
 */
router.get('/agreements/:type/:region/:version', (request: express.Request, response: express.Response): void => {
	response.set('Content-Type', 'text/xml');
	response.set('Server', 'Nintendo 3DS (http)');
	response.set('X-Nintendo-Date', new Date().getTime().toString());

	response.send(xmlbuilder.create({
		agreements: {
			agreement: [
				{
					country: 'US',
					language: 'en',
					language_name: 'English',
					publish_date: '2014-09-29T20:07:35',
					texts: {
						'@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
						'@xsi:type': 'chunkedStoredAgreementText',

						main_title: {
							'#cdata': 'Pretendo Network Services Agreement'
						},
						agree_text: {
							'#cdata': 'I Accept'
						},
						non_agree_text: {
							'#cdata': 'I Decline'
						},
						main_text: {
							'@index': '1',
							'#cdata': 'Welcome to Pretendo\'s Christmas public beta! This is supplied with no liability or warranty, and is a stress test of our current services.This test is not expected to last long- term, and the data may be kept for later testing; this data will not be shared outside of Pretendo, and will be deleted at the end of our testing period.'
						},
						sub_title: {
							'#cdata': 'Privacy Policy'
						},
						sub_text: {
							'@index': '1',
							'#cdata': 'Welcome to Pretendo\'s Christmas public beta! This is supplied with no liability or warranty, and is a stress test of our current services.This test is not expected to last long- term, and the data may be kept for later testing; this data will not be shared outside of Pretendo, and will be deleted at the end of our testing period.'
						},
					},
					type: 'NINTENDO-NETWORK-EULA',
					version: '0300',
				},
				{
					country: 'US',
					language: 'en',
					language_name: 'Español',
					publish_date: '2014-09-29T20:07:35',
					texts: {
						'@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
						'@xsi:type': 'chunkedStoredAgreementText',

						main_title: {
							'#cdata': 'Pretendo Network Services Agreement'
						},
						agree_text: {
							'#cdata': 'I Accept'
						},
						non_agree_text: {
							'#cdata': 'I Decline'
						},
						main_text: {
							'@index': '1',
							'#cdata': 'Welcome to Pretendo\'s Christmas public beta! This is supplied with no liability or warranty, and is a stress test of our current services.This test is not expected to last long- term, and the data may be kept for later testing; this data will not be shared outside of Pretendo, and will be deleted at the end of our testing period.'
						},
						sub_title: {
							'#cdata': 'Privacy Policy'
						},
						sub_text: {
							'@index': '1',
							'#cdata': 'Welcome to Pretendo\'s Christmas public beta! This is supplied with no liability or warranty, and is a stress test of our current services.This test is not expected to last long- term, and the data may be kept for later testing; this data will not be shared outside of Pretendo, and will be deleted at the end of our testing period.'
						},
					},
					type: 'NINTENDO-NETWORK-EULA',
					version: '0300',
				},
				{
					country: 'US',
					language: 'en',
					language_name: 'Français',
					publish_date: '2014-09-29T20:07:35',
					texts: {
						'@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
						'@xsi:type': 'chunkedStoredAgreementText',

						main_title: {
							'#cdata': 'Pretendo Network Services Agreement'
						},
						agree_text: {
							'#cdata': 'I Accept'
						},
						non_agree_text: {
							'#cdata': 'I Decline'
						},
						main_text: {
							'@index': '1',
							'#cdata': 'Welcome to Pretendo\'s Christmas public beta! This is supplied with no liability or warranty, and is a stress test of our current services.This test is not expected to last long- term, and the data may be kept for later testing; this data will not be shared outside of Pretendo, and will be deleted at the end of our testing period.'
						},
						sub_title: {
							'#cdata': 'Privacy Policy'
						},
						sub_text: {
							'@index': '1',
							'#cdata': 'Welcome to Pretendo\'s Christmas public beta! This is supplied with no liability or warranty, and is a stress test of our current services.This test is not expected to last long- term, and the data may be kept for later testing; this data will not be shared outside of Pretendo, and will be deleted at the end of our testing period.'
						},
					},
					type: 'NINTENDO-NETWORK-EULA',
					version: '0300',
				}
			]
		}
	}).end());
});

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/content/time_zones/COUNTRY/LANGUAGE
 * Description: Sends the client the requested timezones
 */
router.get('/time_zones/:countryCode/:language', (request: express.Request, response: express.Response): void => {
	response.set('Content-Type', 'text/xml');
	response.set('Server', 'Nintendo 3DS (http)');
	response.set('X-Nintendo-Date', new Date().getTime().toString());

	/*
	// Old method. Crashes WiiU when sending a list with over 32 entries, but otherwise works
	// countryTimezones is "countries-and-timezones" module

	const country = countryTimezones.getCountry(countryCode);
	const timezones = country.timezones.map((timezone, index) => {
		const data = countryTimezones.getTimezone(timezone);

		return {
			area: data.name,
			language,
			name: data.name,
			utc_offset: data.utcOffset * 6 * 10,
			order: index+1
		};
	});
	*/

	const countryCode = request.params.countryCode;
	const language = request.params.language;

	const regionLanguages = timezones[countryCode as keyof typeof timezones];
	const regionTimezones = regionLanguages[language as keyof typeof regionLanguages] ? regionLanguages[language as keyof typeof regionLanguages] : Object.values(regionLanguages)[0];

	response.send(xmlbuilder.create({
		timezones: {
			timezone: regionTimezones
		}
	}).end());
});

export default router;