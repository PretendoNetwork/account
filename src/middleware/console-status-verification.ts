import crypto from 'node:crypto';
import express from 'express';
import xmlbuilder from 'xmlbuilder';
import { Device } from '@/models/device';
import { getValueFromHeaders } from '@/util';
import { HydratedDeviceDocument } from '@/types/mongoose/device';

async function consoleStatusVerificationMiddleware(request: express.Request, response: express.Response, next: express.NextFunction): Promise<void> {
	if (!request.certificate || !request.certificate.valid) {
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

	const deviceIDHeader: string | undefined = getValueFromHeaders(request.headers, 'x-nintendo-device-id');

	if (!deviceIDHeader) {
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

	const deviceID: number = Number(deviceIDHeader);

	if (isNaN(deviceID)) {
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

	const serialNumber: string | undefined = getValueFromHeaders(request.headers, 'x-nintendo-serial-number');

	if (!serialNumber) {
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

	// * This is kinda temp for now. Needs to be redone to handle linking this data to existing 3DS devices in the DB
	// TODO - 3DS consoles are created in the NASC middleware. They need special handling to link them up with the data in the NNID API!
	if (request.certificate.consoleType === 'wiiu') {
		const certificateDeviceID: number = parseInt(request.certificate.certificateName.slice(2), 16);

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
		const certificateHash: string = crypto.createHash('sha256').update(request.certificate._certificate).digest('base64');

		let device: HydratedDeviceDocument | null = await Device.findOne({
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