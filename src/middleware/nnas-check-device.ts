import crypto from 'node:crypto';
import express from 'express';
import xmlbuilder from 'xmlbuilder';
import NintendoCertificate from '@/nintendo-certificate';
import { Device } from '@/models/device';

// * These endpoints are requested by the Wii U prior to sending it's device certificate.
// * We cannot validate Wii U console details in these endpoints
const INSECURE_WIIU_ENDPOINTS = [
	/^\/v1\/api\/devices\/@current\/status\/?$/,
	/^\/v1\/api\/content\/agreements\/Nintendo-Network-EULA\/[A-Z]{2}\/@latest\/?$/, // TODO - Should this be a bit more flexible, changing the type and version?
	/^\/v1\/api\/content\/time_zones\/[A-Z]{2}\/[a-z]{2}\/?$/,
	/^\/v1\/api\/people\/\w{6,16}\/?$/, // TODO - "\w" is NOT the correct filter here, there's additional rules. But this works for now. See https://en-americas-support.nintendo.com/app/answers/detail/a_id/2221
	/^\/v1\/api\/support\/validate\/email\/?$/,
	/^\/v1\/account-settings\/?/ // * Disable all of these routes, don't check the end of the string
];

// * These endpoints are known to always have a certificate, on both consoles.
// * Any other endpoint only has a certificate sent to it on the 3DS, on the Wii U
// * we can only use the device ID and serial for lookups in those cases
const REQUIRED_CERT_CHECK_ENDPOINTS = [
	/^\/v1\/api\/oauth20\/access_token\/generate\/?$/,
	/^\/v1\/api\/people\/?$/,
	/^\/v1\/api\/people\/@me\/agreements\/?$/, // TODO - We don't actually implement this endpoint yet
	/^\/v1\/api\/people\/@me\/devices\/?$/,
	/^\/v1\/api\/people\/@me\/devices\/owner\/?$/
];

async function nnasCheckDeviceMiddleware(request: express.Request, response: express.Response, next: express.NextFunction): Promise<void> {
	const platformID = request.header('X-Nintendo-Platform-ID')!;
	const deviceID = Number(request.header('X-Nintendo-Device-ID')!);
	const serialNumber = request.header('X-Nintendo-Serial-Number')!;
	const deviceCertificate = request.header('X-Nintendo-Device-Cert');
	const path = request.originalUrl.split('?')[0];

	if (platformID === '1' && INSECURE_WIIU_ENDPOINTS.some(regex => regex.test(path))) {
		// * Some Wii U endpoints cannot be validated, since they are called prior to seeing a certificate
		return next();
	}

	// * 3DS ALWAYS sends the device certificate
	if (platformID === '0' && deviceCertificate == undefined) {
		response.status(400).send(xmlbuilder.create({
			error: {
				code: '0110',
				message: 'Unlinked device'
			}
		}).end());

		return;
	}

	const shouldCheckCertificate = deviceCertificate !== undefined || platformID === '0' || REQUIRED_CERT_CHECK_ENDPOINTS.some(regex => regex.test(path));

	if (shouldCheckCertificate) {
		if (deviceCertificate === undefined) {
			response.status(400).send(xmlbuilder.create({
				error: {
					code: '0110',
					message: 'Unlinked device'
				}
			}).end());

			return;
		}

		const certificate = new NintendoCertificate(deviceCertificate);

		if (!certificate.valid) {
			response.status(400).send(xmlbuilder.create({
				error: {
					code: '0110',
					message: 'Unlinked device'
				}
			}).end());

			return;
		}

		const certificateDeviceID = parseInt(certificate.certificateName.slice(2).split('-')[0], 16);

		if (deviceID !== certificateDeviceID) {
			// TODO - Change this to a different error
			response.status(400).send(xmlbuilder.create({
				error: {
					cause: 'Bad Request',
					code: '1600',
					message: 'Unable to process request'
				}
			}).end());

			return;
		}

		let device = await Device.findOne({
			serial: serialNumber,
		});

		if (!device && certificate.consoleType === '3ds') {
			// * A 3DS console document will ALWAYS be created by NASC before
			// * Hitting the NNAS server. NASC stores the serial number at
			// * the time the device document was created. Therefore we can
			// * know that serial tampering happened on the 3DS if this fails
			// * to find a device document.
			response.status(400).send(xmlbuilder.create({
				error: {
					code: '0002',
					message: 'serialNumber format is invalid'
				}
			}).end());

			return;
		}

		// * Update 3DS consoles to sync with the data from NASC
		const certificateHash = crypto.createHash('sha256').update(Buffer.from(deviceCertificate, 'base64')).digest('base64');

		if (device && !device.certificate_hash && certificate.consoleType === '3ds') {
			// * First time seeing the 3DS in NNAS, link the device certificate
			device.certificate_hash = certificateHash;

			await device.save();
		}

		if (device && !device.device_id && certificate.consoleType === '3ds') {
			// * First time seeing the 3DS in NNAS, link the device ID
			device.device_id = certificateDeviceID;

			await device.save();
		}

		// * Real device lookup/validation is always done with the certificate
		device = await Device.findOne({
			certificate_hash: certificateHash,
		});

		if (!device) {
			if (certificate.consoleType === '3ds') {
				// * If this happens, something has gone horribly wrong
				// TODO - Change this to a different error
				response.status(400).send(xmlbuilder.create({
					error: {
						cause: 'Bad Request',
						code: '1600',
						message: 'Unable to process request'
					}
				}).end());

				return;
			}

			// * Assume device is a Wii U we've never seen before
			device = await Device.create({
				model: 'wup',
				device_id: deviceID,
				serial: serialNumber,
				linked_pids: [],
				certificate_hash: certificateHash
			});
		}

		if (device.serial !== serialNumber) {
			// * Spoofed serial. Device ID compared to certificate directly earlier
			// TODO - Change this to a different error
			response.status(400).send(xmlbuilder.create({
				error: {
					cause: 'Bad Request',
					code: '1600',
					message: 'Unable to process request'
				}
			}).end());

			return;
		}

		request.device = device;
	} else {
		// * This should only be triggered on the Wii U for endpoints that don't send the device certificate,
		// * but can also be reached AFTER one has been seen (IE, after PNID creation/linking).
		// * This is generally considered safe since endpoints which fall into this category are used AFTER
		// * the Wii U has sent the device certificate to the server, so a valid entry should be made for it
		const device = await Device.findOne({
			device_id: deviceID,
			serial: serialNumber
		});

		if (!device) {
			response.status(400).send(xmlbuilder.create({
				errors: {
					error: {
						cause: 'device_id',
						code: '0113',
						message: 'Unauthorized device'
					}
				}
			}).end());

			return;
		}

		if (device.access_level < 0) {
			response.status(400).send(xmlbuilder.create({
				errors: {
					error: {
						code: '0012',
						message: 'Device has been banned by game server' // TODO - This is not the right error message
					}
				}
			}).end());

			return;
		}

		request.device = device;
	}

	return next();
}

export default nnasCheckDeviceMiddleware;