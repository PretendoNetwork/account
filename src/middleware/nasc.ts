import crypto from 'node:crypto';
import express from 'express';
import mongoose from 'mongoose';
import { Device } from '@/models/device';
import { NEXAccount } from '@/models/nex-account';
import { nascError, nintendoBase64Decode } from '@/util';
import { connection as databaseConnection } from '@/database';
import NintendoCertificate from '@/nintendo-certificate';
import { LOG_ERROR } from '@/logger';
import { NASCRequestParams } from '@/types/services/nasc/request-params';
import { HydratedNEXAccountDocument } from '@/types/mongoose/nex-account';
import { HydratedDeviceDocument } from '@/types/mongoose/device';

async function NASCMiddleware(request: express.Request, response: express.Response, next: express.NextFunction): Promise<void> {
	const requestParams: NASCRequestParams = request.body;

	if (!requestParams.action ||
		!requestParams.fcdcert ||
		!requestParams.csnum ||
		!requestParams.macadr ||
		!requestParams.titleid ||
		!requestParams.servertype
	) {
		response.status(200).send(nascError('null').toString()); // This is what Nintendo sends
		return;
	}

	const action: string = nintendoBase64Decode(requestParams.action).toString();
	const fcdcert: Buffer = nintendoBase64Decode(requestParams.fcdcert);
	const serialNumber: string = nintendoBase64Decode(requestParams.csnum).toString();
	const macAddress: string = nintendoBase64Decode(requestParams.macadr).toString();
	const titleID: string = nintendoBase64Decode(requestParams.titleid).toString();
	const environment: string = nintendoBase64Decode(requestParams.servertype).toString();

	const macAddressHash: string = crypto.createHash('sha256').update(macAddress).digest('base64');
	const fcdcertHash: string = crypto.createHash('sha256').update(fcdcert).digest('base64');

	let pid: number = 0; // * Real PIDs are always positive and non-zero
	let pidHmac: string = '';
	let password: string = '';

	if (requestParams.userid) {
		pid = Number(nintendoBase64Decode(requestParams.userid).toString());
	}

	if (requestParams.uidhmac) {
		pidHmac = nintendoBase64Decode(requestParams.uidhmac).toString();
	}

	if (requestParams.passwd) {
		password = nintendoBase64Decode(requestParams.passwd).toString();
	}

	if (action !== 'LOGIN' && action !== 'SVCLOC') {
		response.status(200).send(nascError('null').toString()); // This is what Nintendo sends
		return;
	}

	const cert: NintendoCertificate = new NintendoCertificate(fcdcert);

	if (!cert.valid) {
		response.status(200).send(nascError('121').toString());
		return;
	}

	if (!validNintendoMACAddress(macAddress)) {
		response.status(200).send(nascError('null').toString());
		return;
	}

	let model: string = '';
	switch (serialNumber[0]) {
		case 'C':
			model = 'ctr';
			break;
		case 'S':
			model = 'spr';
			break;
		case 'A':
			model = 'ftr';
			break;
		case 'Y':
			model = 'ktr';
			break;
		case 'Q':
			model = 'red';
			break;
		case 'N':
			model = 'jan';
			break;
	}

	if (!model) {
		response.status(200).send(nascError('null').toString());
		return;
	}

	const nexAccount: HydratedNEXAccountDocument | null = await NEXAccount.findOne({ pid });

	if (!nexAccount || nexAccount.access_level < 0) {
		response.status(200).send(nascError('102').toString());
		return;
	}

	let device: HydratedDeviceDocument | null = await Device.findOne({
		fcdcert_hash: fcdcertHash,
	});

	if (device) {
		if (device.access_level < 0) {
			response.status(200).send(nascError('102').toString());
			return;
		}

		if (pid) {
			const linkedPIDs: number[] = device.linked_pids;

			// * If a user performs a system transfer from
			// * a console to another using a Nintendo account
			// * during the transfer and both consoles have
			// * a Pretendo account, the devices will be swapped
			// * since we check it using the LFCS.
			// *
			// * So, the linked PIDs won't have the user's PID
			// * anymore.
			if (!linkedPIDs.includes(pid)) {
				device.linked_pids.push(pid);

				await device.save();
			}
		}
	}

	// * Workaround for edge case on system transfers
	// * if a console that has a Pretendo account performs
	// * a system transfer using the Nintendo account to
	// * another that doesn't have a Pretendo account.
	// *
	// * This would make the Pretendo account to not have
	// * a device on the database.
	// *
	// * TODO: With this change, now multiple devices can
	// * have the same serial number and MAC address.
	// * Do we want this? If not, are there other solutions?
	if (!device && pid) {
		device = new Device({
			model,
			serial: serialNumber,
			environment,
			mac_hash: macAddressHash,
			fcdcert_hash: fcdcertHash,
			linked_pids: [pid]
		});

		await device.save();
	}

	if (titleID === '0004013000003202') {
		if (password && !pid && !pidHmac) {
			// Register new user

			const session: mongoose.ClientSession = await databaseConnection().startSession();
			await session.startTransaction();

			try {
				// Create new NEX account
				const nexAccount: HydratedNEXAccountDocument = new NEXAccount({
					device_type: '3ds',
					password
				});

				await nexAccount.generatePID();

				await nexAccount.save({ session });

				pid = nexAccount.pid;

				const pidBuffer: Buffer = Buffer.alloc(4);
				pidBuffer.writeUInt32LE(pid);

				const hash: crypto.Hash = crypto.createHash('sha1').update(pidBuffer);
				const pidHash: Buffer = hash.digest();
				const checksum: number = pidHash[0] >> 1;
				const hex: string = checksum.toString(16) + pid.toString(16);
				const int: number = parseInt(hex, 16);
				const friendCode: string = int.toString().padStart(12, '0').match(/.{1,4}/g)!.join('-');

				nexAccount.friend_code = friendCode;

				await nexAccount.save({ session });

				// Set password

				if (!device) {
					device = new Device({
						model,
						serial: serialNumber,
						environment,
						mac_hash: macAddressHash,
						fcdcert_hash: fcdcertHash,
						linked_pids: [pid]
					});
				} else {
					device.linked_pids.push(pid);
				}

				await device.save({ session });

				await session.commitTransaction();
			} catch (error) {
				LOG_ERROR('[NASC] REGISTER ACCOUNT: ' + error);

				await session.abortTransaction();

				// 3DS expects 200 even on error
				response.status(200).send(nascError('102').toString());
				return;
			} finally {
				// * This runs regardless of failure
				// * Returning on catch will not prevent this from running
				await session.endSession();
			}
		}
	}

	request.nexAccount = nexAccount;

	return next();
}

// https://www.adminsub.net/mac-address-finder/nintendo
// Saves us from doing an OUI lookup each time
const NINTENDO_VENDER_OUIS: string[] = [
	'ECC40D', 'E84ECE', 'E0F6B5', 'E0E751', 'E00C7F', 'DC68EB',
	'D86BF7', 'D4F057', 'CCFB65', 'CC9E00', 'B8AE6E', 'B88AEC',
	'B87826', 'A4C0E1', 'A45C27', 'A438CC', '9CE635', '98E8FA',
	'98B6E9', '98415C', '9458CB', '8CCDE8', '8C56C5', '7CBB8A',
	'78A2A0', '7048F7', '64B5C6', '606BFF', '5C521E', '58BDA3',
	'582F40', '48A5E7', '40F407', '40D28A', '34AF2C', '342FBD',
	'2C10C1', '182A7B', '0403D6', '002709', '002659', '0025A0',
	'0024F3', '002444', '00241E', '0023CC', '002331', '0022D7',
	'0022AA', '00224C', '0021BD', '002147', '001FC5', '001F32',
	'001EA9', '001E35', '001DBC', '001CBE', '001BEA', '001B7A',
	'001AE9', '0019FD', '00191D', '0017AB', '001656', '0009BF',
	'ECC40D', 'E84ECE', 'E0F6B5', 'E0E751', 'E00C7F', 'DC68EB',
	'D86BF7', 'D4F057', 'CCFB65', 'CC9E00', 'B8AE6E', 'B88AEC',
	'B87826', 'A4C0E1', 'A45C27', 'A438CC', '9CE635', '98E8FA',
	'98B6E9', '98415C', '9458CB', '8CCDE8', '8C56C5', '7CBB8A',
	'78A2A0', '7048F7', '64B5C6', '606BFF', '5C521E', '58BDA3',
	'582F40', '48A5E7', '40F407', '40D28A', '34AF2C', '342FBD',
	'2C10C1', '182A7B', '0403D6', '002709', '002659', '0025A0',
	'0024F3', '002444', '00241E', '0023CC', '002331', '0022D7',
	'0022AA', '00224C', '0021BD', '002147', '001FC5', '001F32',
	'001EA9', '001E35', '001DBC', '001CBE', '001BEA', '001B7A',
	'001AE9', '0019FD', '00191D', '0017AB', '001656', '0009BF'
];

// TODO: Make something better
const MAC_REGEX: RegExp = /^[0-9a-fA-F]{12}$/;

// Maybe should later parse more data out
function validNintendoMACAddress(macAddress: string): boolean {
	if (!NINTENDO_VENDER_OUIS.includes(macAddress.substring(0, 6).toUpperCase())) {
		return false;
	}

	return MAC_REGEX.test(macAddress);
}

export default NASCMiddleware;
