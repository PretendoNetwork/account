import crypto from 'node:crypto';
import xmlbuilder from 'xmlbuilder';
import { Device } from '@/models/device';
import { getValueFromHeaders } from '@/util';
import type express from 'express';

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

	const certificateDeviceID = parseInt(request.certificate.certificateName.slice(2).split('-')[0], 16);

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

	let device = await Device.findOne({
		serial: serialNumber
	});

	const certificateHash = crypto.createHash('sha256').update(request.certificate._certificate).digest('base64');

	if (!device && request.certificate.consoleType === '3ds') {
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
	} else if (device && !device.certificate_hash && request.certificate.consoleType === '3ds') {
		device.certificate_hash = certificateHash;

		await device.save();
	}

	device = await Device.findOne({
		certificate_hash: certificateHash
	});

	if (!device) {
		// * Device must be a fresh Wii U
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

	return next();
}

export default consoleStatusVerificationMiddleware;
