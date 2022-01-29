const crypto = require('crypto');
const { Device } = require('../models/device');
const { NEXAccount } = require('../models/nex-account');
const util = require('../util');
const NintendoCertificate = require('../nintendo-certificate');

async function NASCMiddleware(request, response, next) {
	const requestParams = request.body;

	if (!requestParams.action ||
		!requestParams.fcdcert ||
		!requestParams.csnum ||
		!requestParams.macadr ||
		!requestParams.titleid ||
		!requestParams.servertype
	) {
		return util.nascError(response, 'null'); // This is what Nintendo sends
	}

	const action = util.nintendoBase64Decode(requestParams.action).toString();
	const fcdcert = util.nintendoBase64Decode(requestParams.fcdcert);
	const serialNumber = util.nintendoBase64Decode(requestParams.csnum).toString();
	const macAddress = util.nintendoBase64Decode(requestParams.macadr).toString();
	const titleID = util.nintendoBase64Decode(requestParams.titleid).toString();
	const environment = util.nintendoBase64Decode(requestParams.servertype).toString();

	const macAddressHash = crypto.createHash('sha256').update(macAddress).digest('base64');
	const fcdcertHash = crypto.createHash('sha256').update(fcdcert).digest('base64');

	let pid;
	let pidHmac;
	let password;

	if (requestParams.userid) {
		pid = util.nintendoBase64Decode(requestParams.userid).toString();
	}

	if (requestParams.uidhmac) {
		pidHmac = util.nintendoBase64Decode(requestParams.uidhmac).toString();
	}

	if (requestParams.passwd) {
		password = util.nintendoBase64Decode(requestParams.passwd).toString();
	}

	if (action !== 'LOGIN') {
		return util.nascError(response, 'null'); // This is what Nintendo sends
	}

	const cert = new NintendoCertificate(fcdcert);
	
	if (!cert.valid) {
		return util.nascError(response, '121');
	}

	if (!validNintendoMACAddress(macAddress)) {
		return util.nascError(response, 'null');
	}

	let model;
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
		return util.nascError(response, 'null');
	}

	let device = await Device.findOne({
		model,
		serial: serialNumber,
		environment,
		mac_hash: macAddressHash,
		fcdcert_hash: fcdcertHash,
	});

	if (device) {
		if (device.get('access_level') < 0) {
			return util.nascError(response, '102');
		}

		if (pid) {
			const linkedPIDs = device.get('linked_pids');

			if (!linkedPIDs.includes(pid)) {
				return util.nascError(response, '102');
			}
		}
	}

	if (titleID === '0004013000003202') {
		if (password && !pid && !pidHmac) {
			// Register new user

			// Create new NEX account
			const newNEXAccount = new NEXAccount({
				pid: 0,
				password: '',
				owning_pid: 0,
			});
			await newNEXAccount.save();

			pid = newNEXAccount.get('pid');

			// Set password
			await NEXAccount.updateOne({ pid }, { password });

			if (!device) {
				const deviceDocument = {
					is_emulator: false,
					model,
					serial: serialNumber,
					environment,
					mac_hash: macAddressHash,
					fcdcert_hash: fcdcertHash,
					linked_pids: [pid]
				};
				
				device = new Device(deviceDocument);
			} else {
				device.linked_pids.push(pid);
			}

			await device.save();
		}
	}

	const nexUser = await NEXAccount.findOne({ pid });

	if (!nexUser || nexUser.get('access_level') < 0) {
		return util.nascError(response, '102');
	}

	request.nexUser = nexUser;
	request.device = device;

	return next();
}

// https://www.adminsub.net/mac-address-finder/nintendo
// Saves us from doing an OUI lookup each time
const NINTENDO_VENDER_OUIS = [
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
const MAC_REGEX = /^[0-9a-fA-F]{12}$/;

// Maybe should later parse more data out
function validNintendoMACAddress(macAddress) {
	if (!NINTENDO_VENDER_OUIS.includes(macAddress.substring(0, 6).toUpperCase())) {
		return false;
	}

	return MAC_REGEX.test(macAddress);
}

module.exports = NASCMiddleware;