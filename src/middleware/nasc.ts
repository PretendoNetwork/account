import crypto from 'node:crypto';
import { Device } from '@/models/device';
import { NEXAccount } from '@/models/nex-account';
import { nascError, nintendoBase64Decode } from '@/util';
import { connection as databaseConnection } from '@/database';
import NintendoCertificate from '@/nintendo-certificate';
import { LOG_ERROR } from '@/logger';
import type express from 'express';
import type { NASCRequestParams } from '@/types/services/nasc/request-params';

async function NASCMiddleware(request: express.Request, response: express.Response, next: express.NextFunction): Promise<void> {
	const requestParams: NASCRequestParams = request.body;

	if (!requestParams.action ||
		!requestParams.fcdcert ||
		!requestParams.csnum ||
		!requestParams.macadr ||
		!requestParams.titleid ||
		!requestParams.servertype ||
		!requestParams.gameid
	) {
		response.status(200).send(nascError('null').toString()); // * This is what Nintendo sends
		return;
	}

	const action = nintendoBase64Decode(requestParams.action).toString();
	const fcdcert = nintendoBase64Decode(requestParams.fcdcert);
	const serialNumber = nintendoBase64Decode(requestParams.csnum).toString();
	const macAddress = nintendoBase64Decode(requestParams.macadr).toString();
	const titleID = nintendoBase64Decode(requestParams.titleid).toString();
	const environment = nintendoBase64Decode(requestParams.servertype).toString();

	const macAddressHash = crypto.createHash('sha256').update(macAddress).digest('base64');
	const fcdcertHash = crypto.createHash('sha256').update(fcdcert).digest('base64');

	let pid = 0; // * Real PIDs are always positive and non-zero
	let pidHmac = '';
	let password = '';

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
		response.status(200).send(nascError('null').toString()); // * This is what Nintendo sends
		return;
	}

	const cert = new NintendoCertificate(fcdcert);

	if (!cert.valid) {
		response.status(200).send(nascError('121').toString());
		return;
	}

	if (!validNintendoMACAddress(macAddress)) {
		response.status(200).send(nascError('null').toString());
		return;
	}

	let model = '';
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

	let nexAccount = null;
	if (pid) {
		nexAccount = await NEXAccount.findOne({ pid });

		// TODO - 102 is a DEVICE ban. Is there an error for ACCOUNT bans?
		if (!nexAccount || nexAccount.access_level < 0) {
			response.status(200).send(nascError('102').toString());
			return;
		}
	}

	let device = await Device.findOne({
		fcdcert_hash: fcdcertHash
	});

	if (device) {
		if (device.access_level < 0) {
			response.status(200).send(nascError('102').toString());
			return;
		}

		if (pid) {
			const linkedPIDs = device.linked_pids;

			// * If a user performs a system transfer from
			// * a console to another using a Nintendo account
			// * during the transfer and both consoles have
			// * a Pretendo account, the new device won't have
			// * the user's PID.
			// *
			// * So, the linked PIDs won't have the user's PID
			// * anymore.
			if (!linkedPIDs.includes(pid)) {
				device.linked_pids.push(pid);

				await device.save();
			}
		}

		if (device.serial !== serialNumber) {
			// * 150 is a custom error code
			response.status(200).send(nascError('150').toString());
			return;
		}
	}

	// * Workaround for edge case on system transfers
	// * if a console that has a Pretendo account performs
	// * a system transfer using the Nintendo account to
	// * another that doesn't have a Pretendo account.
	// *
	// * This would make the Pretendo account to not have
	// * a device on the database.
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
			// * Register new user

			const session = await databaseConnection().startSession();
			await session.startTransaction();

			try {
				// * Create new NEX account
				nexAccount = new NEXAccount({
					device_type: '3ds',
					password
				});

				await nexAccount.generatePID();

				await nexAccount.save({ session });

				pid = nexAccount.pid;

				const pidBuffer = Buffer.alloc(4);
				pidBuffer.writeUInt32LE(pid);

				const hash = crypto.createHash('sha1').update(pidBuffer);
				const pidHash = hash.digest();
				const checksum = pidHash[0] >> 1;
				const hex = checksum.toString(16) + pid.toString(16);
				const int = parseInt(hex, 16);
				const friendCode = int.toString().padStart(12, '0').match(/.{1,4}/g)!.join('-');

				nexAccount.friend_code = friendCode;

				await nexAccount.save({ session });

				// * Set password

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

				// * 151 is a custom error code
				response.status(200).send(nascError('151').toString());
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

// * https://standards-oui.ieee.org
// * Saves us from doing an OUI lookup each time
const NINTENDO_VENDER_OUIS = [
	'601AC7', 'BC9EBB', 'CC5B31', '1C4586', 'E8A0CD', '702C09',
	'7048F7', '98E8FA', 'ECC40D', '606BFF', '64B5C6', '40D28A',
	'A45C27', '8C56C5', '002659', '00241E', '002444', '98E255',
	'E0EFBF', '948E6D', '38C6CE', 'C89143', 'DCCD18', '28CF51',
	'58B03E', '200BCF', '748469', '70F088', '9458CB', '582F40',
	'B88AEC', 'A438CC', '40F407', 'A4C0E1', '0022D7', '001CBE',
	'001B7A', '001AE9', '0009BF', '904528', 'ACFAE4', 'BC89A6',
	'201C3A', '7820A5', 'E0F6B5', '342FBD', '98415C', 'D4F057',
	'5C521E', '98B6E9', 'CCFB65', 'B8AE6E', '182A7B', '2C10C1',
	'002331', '001E35', '001BEA', '0017AB', '001656', 'BC744B',
	'3CA9AB', 'C84805', 'C0A4CF', '3089EC', '483177', '50236D',
	'D05509', 'E8DA20', '7CBB8A', '34AF2C', '78A2A0', 'E84ECE',
	'002709', '0025A0', '0024F3', '0023CC', '001F32', '001EA9',
	'001DBC', '0019FD', '00191D', 'A4C1E8', 'D86B83', '4044F7',
	'B86870', 'BCCE25', '80D2E5', '5C0CE6', '74F9CA', '48A5E7',
	'B87826', 'DC68EB', '0403D6', '9CE635', '8CCDE8', '58BDA3',
	'E00C7F', 'CC9E00', 'D86BF7', 'E0E751', '0022AA', '00224C',
	'0021BD', '002147', '001FC5', '48F1EB', '78818C', '4C306A'
];

// TODO - Make something better
const MAC_REGEX = /^[0-9a-fA-F]{12}$/;

// * Maybe should later parse more data out
function validNintendoMACAddress(macAddress: string): boolean {
	if (!NINTENDO_VENDER_OUIS.includes(macAddress.substring(0, 6).toUpperCase())) {
		return false;
	}

	return MAC_REGEX.test(macAddress);
}

export default NASCMiddleware;
