const router = require('express').Router();
const xmlbuilder = require('xmlbuilder');
const timezones = require('../timezones.json');
const clientHeaderCheck = require('../../../middleware/client-header');

/**
 * [GET]
 * Replacement for: https://account.nintendo.net/v1/api/content/agreements/TYPE/REGION/VERSION
 * Description: Sends the client requested agreement
 */
router.get('/agreements/:type/:region/:version', clientHeaderCheck, (request, response) => {
	response.set('Content-Type', 'text/xml');
	response.set('Server', 'Nintendo 3DS (http)');
	response.set('X-Nintendo-Date', new Date().getTime());

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
							'#cdata': 'Dont be dumb'
						},
						sub_title: {
							'#cdata': 'Privacy Policy'
						},
						sub_text: {
							'@index': '1',
							'#cdata': 'Dont be dumb again'
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
							'#cdata': 'Dont be dumb'
						},
						sub_title: {
							'#cdata': 'Privacy Policy'
						},
						sub_text: {
							'@index': '1',
							'#cdata': 'Dont be dumb again'
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
							'#cdata': 'Dont be dumb'
						},
						sub_title: {
							'#cdata': 'Privacy Policy'
						},
						sub_text: {
							'@index': '1',
							'#cdata': 'Dont be dumb again'
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
router.get('/time_zones/:countryCode/:language', clientHeaderCheck, (request, response) => {
	response.set('Content-Type', 'text/xml');
	response.set('Server', 'Nintendo 3DS (http)');
	response.set('X-Nintendo-Date', new Date().getTime());

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

	const { countryCode, language } = request.params;

	const regionLanguages = timezones[countryCode];
	const regionTimezones = regionLanguages[language] ? regionLanguages[language] : Object.values(regionLanguages)[0];

	response.send(xmlbuilder.create({
		timezones: {
			timezone: regionTimezones
		}
	}).end());
});

module.exports = router;
