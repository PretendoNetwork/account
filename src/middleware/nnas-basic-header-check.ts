import express from 'express';
import xmlbuilder from 'xmlbuilder';

const VALID_CLIENT_ID_SECRET_PAIRS: Record<string, string> = {
	// * 'Key' is the client ID, 'Value' is the client secret
	'a2efa818a34fa16b8afbc8a74eba3eda': 'c91cdb5658bd4954ade78533a339cf9a', // * Wii U
	'ea25c66c26b403376b4c5ed94ab9cdea': 'd137be62cb6a2b831cad8c013b92fb55' // * 3DS
};

const SYSTEM_VERSIONS = {
	'0': '0320', // * 3DS
	'1': '0270' // * Wii U
};

const REGIONS = [
	'1', // * JPN
	'2', // * USA
	'4', // * EUR
	'8', // * AUS
	'16', // * CHN
	'32', // * KOR
	'64' // * TWN
];

const DEVICE_ID = /^\d{10}$/; // TODO - Are these ALWAYS 10 digits?
const SERIAL_REGEX = /^[A-Z]{2,3}\d{8,9}$/; // TODO - This is not robust, and may be wrong. See brew wikis (https://www.3dbrew.org/wiki/Serials, https://wiiubrew.org/wiki/Product_Information#Product_Serial_Numbers)

// * Checks only for the existence of common headers and does some sanity checks
function nnasBasicHeaderCheckMiddleware(request: express.Request, response: express.Response, next: express.NextFunction): void {
	response.set('Content-Type', 'text/xml');
	response.set('Server', 'Nintendo 3DS (http)');
	response.set('X-Nintendo-Date', new Date().getTime().toString());

	const platformID = request.header('X-Nintendo-Platform-ID');
	const deviceType = request.header('X-Nintendo-Device-Type');
	const deviceID = request.header('X-Nintendo-Device-ID');
	const serialNumber = request.header('X-Nintendo-Serial-Number');
	const systemVersion = request.header('X-Nintendo-System-Version');
	const region = request.header('X-Nintendo-Region');
	const country = request.header('X-Nintendo-Country');
	const clientID = request.header('X-Nintendo-Client-ID');
	const clientSecret = request.header('X-Nintendo-Client-Secret');
	const friendsVersion = request.header('X-Nintendo-FPD-Version');
	const environment = request.header('X-Nintendo-Environment');
	const titleID = request.header('X-Nintendo-Title-ID');
	const uniqueID = request.header('X-Nintendo-Unique-ID');
	const applicationVersion = request.header('X-Nintendo-Application-Version');
	const model = request.header('X-Nintendo-Device-Model');
	const deviceCertificate = request.header('X-Nintendo-Device-Cert');

	// * 0 = 3DS, 1 = Wii U
	if (platformID === undefined || (platformID !== '0' && platformID !== '1')) {
		response.send(xmlbuilder.create({
			errors: {
				error: {
					code: '0002',
					message: 'platformId format is invalid'
				}
			}
		}).end());

		return;
	}

	// * 1 = debug, 2 = retail
	if (deviceType === undefined || (deviceType !== '1' && deviceType !== '2')) {
		// TODO - Unsure if this is the right error
		response.send(xmlbuilder.create({
			errors: {
				error: {
					code: '0002',
					message: 'Device type format is invalid'
				}
			}
		}).end());

		return;
	}

	if (deviceID === undefined || !DEVICE_ID.test(deviceID)) {
		response.send(xmlbuilder.create({
			errors: {
				error: {
					code: '0002',
					message: 'deviceId format is invalid'
				}
			}
		}).end());

		return;
	}

	if (serialNumber === undefined || !SERIAL_REGEX.test(serialNumber)) {
		response.send(xmlbuilder.create({
			errors: {
				error: {
					code: '0002',
					message: 'serialNumber format is invalid'
				}
			}
		}).end());

		return;
	}

	// TODO - Should the version check throw SYSTEM_UPDATE_REQUIRED?
	if (systemVersion === undefined || SYSTEM_VERSIONS[platformID] !== systemVersion) {
		response.send(xmlbuilder.create({
			errors: {
				error: {
					code: '0002',
					message: 'version format is invalid'
				}
			}
		}).end());

		return;
	}

	if (region === undefined || !REGIONS.includes(region)) {
		response.send(xmlbuilder.create({
			errors: {
				error: {
					code: '0002',
					message: 'X-Nintendo-Region format is invalid'
				}
			}
		}).end());

		return;
	}

	if (country === undefined) {
		response.send(xmlbuilder.create({
			errors: {
				error: {
					code: '0002',
					message: 'X-Nintendo-Region format is invalid'
				}
			}
		}).end());

		return;
	}

	// TODO - Check the platform too?
	if (
		clientID === undefined ||
		clientSecret === undefined ||
		!VALID_CLIENT_ID_SECRET_PAIRS[clientID] ||
		clientSecret !== VALID_CLIENT_ID_SECRET_PAIRS[clientID]
	) {
		response.send(xmlbuilder.create({
			errors: {
				error: {
					cause: 'client_id',
					code: '0004',
					message: 'API application invalid or incorrect application credentials'
				}
			}
		}).end());

		return;
	}

	if (friendsVersion === undefined || friendsVersion !== '0000') {
		// TODO - Unsure if this is the right error
		response.send(xmlbuilder.create({
			errors: {
				error: {
					code: '0002',
					message: 'Friends version is invalid'
				}
			}
		}).end());

		return;
	}

	// TODO - Check this against valid list
	if (environment === undefined) {
		response.send(xmlbuilder.create({
			errors: {
				error: {
					code: '1017',
					message: 'The requested game environment wasn\'t found for the given game server.'
				}
			}
		}).end());

		return;
	}

	if (titleID === undefined) {
		// TODO - Unsure if this is the right error
		response.send(xmlbuilder.create({
			errors: {
				error: {
					code: '0002',
					message: 'Title ID format is invalid'
				}
			}
		}).end());

		return;
	}

	if (uniqueID === undefined) {
		// TODO - Unsure if this is the right error
		response.send(xmlbuilder.create({
			errors: {
				error: {
					code: '0002',
					message: 'Unique ID format is invalid'
				}
			}
		}).end());

		return;
	}

	if (applicationVersion === undefined) {
		// TODO - Unsure if this is the right error
		response.send(xmlbuilder.create({
			errors: {
				error: {
					code: '0002',
					message: 'Application version format is invalid'
				}
			}
		}).end());

		return;
	}

	if (platformID === '0' && model === undefined) {
		// TODO - Unsure if this is the right error
		response.send(xmlbuilder.create({
			errors: {
				error: {
					code: '0002',
					message: 'Model format is invalid'
				}
			}
		}).end());

		return;
	}

	if (platformID === '0' && deviceCertificate === undefined) {
		response.status(400).send(xmlbuilder.create({
			error: {
				code: '0110',
				message: 'Unlinked device'
			}
		}).end());

		return;
	}

	return next();
}

export default nnasBasicHeaderCheckMiddleware;