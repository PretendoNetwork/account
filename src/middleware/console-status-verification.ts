import crypto from 'node:crypto';
import express from 'express';
import xmlbuilder from 'xmlbuilder';
import { Device } from '@/models/device';
import { getValueFromHeaders } from '@/util';

async function consoleStatusVerificationMiddleware(request: express.Request, response: express.Response, next: express.NextFunction): Promise<void> {
	if (!request.certificate || !request.certificate.valid) {
		response.status(400).send(xmlbuilder.create({
			error: {
				code: '0110',
				message: 'Unlinked device'
			}
		}).end());

		return;
	}

	const deviceIDHeader = getValueFromHeaders(request.headers, 'x-nintendo-device-id');

	if (!deviceIDHeader) {
		response.status(400).send(xmlbuilder.create({
			error: {
				code: '0002',
				message: 'deviceId format is invalid'
			}
		}).end());

		return;
	}

	const deviceID = Number(deviceIDHeader);

	if (isNaN(deviceID)) {
		response.status(400).send(xmlbuilder.create({
			error: {
				code: '0002',
				message: 'deviceId format is invalid'
			}
		}).end());

		return;
	}

	const serialNumber = getValueFromHeaders(request.headers, 'x-nintendo-serial-number');

	// TODO - Verify serial numbers somehow?
	// * This is difficult to do safely because serial numbers are
	// * inherently insecure.
	// * Information about their structure can be found here:
	// * https://www.3dbrew.org/wiki/Serials
	// * Given this, anyone can generate a valid serial number which
	// * passes these checks, even if the serial number isn't real.
	// * The 3DS also futher complicates things, as it never sends
	// * the complete serial number. The 3DS omits the check digit,
	// * meaning any attempt to verify the serial number of a 3DS
	// * family of console will ALWAYS fail. Nintendo likely just
	// * has a database of all known serials which they are able to
	// * compare against. We are not so lucky
	if (!serialNumber) {
		response.status(400).send(xmlbuilder.create({
			error: {
				code: '0002',
				message: 'serialNumber format is invalid'
			}
		}).end());

		return;
	}

	// * This is kinda temp for now. Needs to be redone to handle linking this data to existing 3DS devices in the DB
	// TODO - 3DS consoles are created in the NASC middleware. They need special handling to link them up with the data in the NNID API!
	if (request.certificate.consoleType === 'wiiu') {
		const certificateDeviceID = parseInt(request.certificate.certificateName.slice(2), 16);

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

		// * Only store a hash of the certificate in case of a breach
		const certificateHash = crypto.createHash('sha256').update(request.certificate._certificate).digest('base64');

		let device = await Device.findOne({
			certificate_hash: certificateHash,
		});

		if (!device) {
			device = await Device.create({
				model: 'wup',
				device_id: deviceID,
				serial: serialNumber,
				linked_pids: [],
				certificate_hash: certificateHash
			});
		}

		if (device.serial !== serialNumber) {
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

export default consoleStatusVerificationMiddleware;