import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import joi from 'joi';
import { nintendoPasswordHash, decryptToken, unpackToken } from '@/util';
import { PNID } from '@/models/pnid';
import { Server } from '@/models/server';
import { LOG_ERROR } from '@/logger';
import { config } from '@/config-manager';
import { HydratedPNIDDocument } from '@/types/mongoose/pnid';
import { HydratedDeviceDocument } from '@/types/mongoose/device';
import { HydratedServerDocument } from '@/types/mongoose/server';
import { Token } from '@/types/common/token';
import { PNIDProfile } from '@/types/services/nnid/pnid-profile';
import { ConnectionData } from '@/types/services/api/connection-data';
import { ConnectionResponse } from '@/types/services/api/connection-response';
import { DiscordConnectionData } from '@/types/services/api/discord-connection-data';

const connection_string: string = config.mongoose.connection_string;
const options: mongoose.ConnectOptions = config.mongoose.options;

// TODO: Extend this later with more settings
const discordConnectionSchema: joi.ObjectSchema = joi.object({
	id: joi.string()
});

let _connection: mongoose.Connection;

export async function connect(): Promise<void> {
	await mongoose.connect(connection_string, options);

	_connection = mongoose.connection;
	_connection.on('error', console.error.bind(console, 'connection error:'));
}

export function connection(): mongoose.Connection {
	return _connection;
}

export function verifyConnected(): void {
	if (!connection()) {
		throw new Error('Cannot make database requets without being connected');
	}
}

export async function getUserByUsername(username: string): Promise<HydratedPNIDDocument> {
	verifyConnected();

	return await PNID.findOne<HydratedPNIDDocument>({
		usernameLower: username.toLowerCase()
	});
}

export async function getUserByPID(pid: number): Promise<HydratedPNIDDocument> {
	verifyConnected();

	return await PNID.findOne<HydratedPNIDDocument>({
		pid
	});
}

export async function getUserByEmailAddress(email: string): Promise<HydratedPNIDDocument> {
	verifyConnected();

	// TODO - Update documents to store email normalized
	return await PNID.findOne<HydratedPNIDDocument>({
		'email.address': email
	});
}

export async function doesUserExist(username: string): Promise<boolean> {
	verifyConnected();

	return !!await getUserByUsername(username);
}

export async function getUserBasic(token: string): Promise<HydratedPNIDDocument> {
	verifyConnected();

	// * Wii U sends Basic auth as `username password`, where the password may not have spaces
	// * This is not to spec, but that is the consoles fault not ours
	const decoded: string = Buffer.from(token, 'base64').toString();
	const parts: string[] = decoded.split(' ');

	const username: string = parts[0];
	const password: string = parts[1];

	const user: HydratedPNIDDocument = await getUserByUsername(username);

	if (!user) {
		return null;
	}

	const hashedPassword: string = nintendoPasswordHash(password, user.pid);

	if (!bcrypt.compareSync(hashedPassword, user.password)) {
		return null;
	}

	return user;
}

export async function getUserBearer(token: string): Promise<HydratedPNIDDocument> {
	verifyConnected();

	try {
		const decryptedToken: Buffer = await decryptToken(Buffer.from(token, 'base64'));
		const unpackedToken: Token = unpackToken(decryptedToken);

		const user: HydratedPNIDDocument = await getUserByPID(unpackedToken.pid);

		if (user) {
			const expireTime: number = Math.floor((Number(unpackedToken.expire_time) / 1000));

			if (Math.floor(Date.now() / 1000) > expireTime) {
				return null;
			}
		}

		return user;
	} catch (error: any) {
		// TODO: Handle error
		LOG_ERROR(error);
		return null;
	}
}

export async function getUserProfileJSONByPID(pid: number): Promise<PNIDProfile> {
	verifyConnected();

	const user: HydratedPNIDDocument = await getUserByPID(pid);
	const device: HydratedDeviceDocument = user.get('devices')[0]; // * Just grab the first device
	let device_attributes: [{
		device_attribute: {
			name: string;
			value: string;
			created_date: string;
		};
	}];

	if (device) {
		device_attributes = device.get('device_attributes').map(({name, value, created_date}) => ({
			device_attribute: {
				name,
				value,
				created_date: created_date ? created_date : ''
			}
		}));
	}

	return <PNIDProfile>{
		//accounts: {}, // * We need to figure this out, no idea what these values mean or what they do
		active_flag: user.get('flags.active') ? 'Y' : 'N',
		birth_date: user.get('birthdate'),
		country: user.get('country'),
		create_date: user.get('creation_date'),
		device_attributes: device_attributes,
		gender: user.get('gender'),
		language: user.get('language'),
		updated: user.get('updated'),
		marketing_flag: user.get('flags.marketing') ? 'Y' : 'N',
		off_device_flag: user.get('flags.off_device') ? 'Y' : 'N',
		pid: user.get('pid'),
		email: {
			address: user.get('email.address'),
			id: user.get('email.id'),
			parent: user.get('email.parent') ? 'Y' : 'N',
			primary: user.get('email.primary') ? 'Y' : 'N',
			reachable: user.get('email.reachable') ? 'Y' : 'N',
			type: 'DEFAULT',
			updated_by: 'USER', // * Can also be INTERNAL WS, don't know the difference
			validated: user.get('email.validated') ? 'Y' : 'N',
			validated_date: user.get('email.validated') ? user.get('email.validated_date') : ''
		},
		mii: {
			status: 'COMPLETED',
			data: user.get('mii.data').replace(/(\r\n|\n|\r)/gm, ''),
			id: user.get('mii.id'),
			mii_hash: user.get('mii.hash'),
			mii_images: {
				mii_image: {
					// * Images MUST be loaded over HTTPS or console ignores them
					// * Bunny CDN is the only CDN which seems to support TLS 1.0/1.1 (required)
					cached_url: `${config.cdn.base_url}/mii/${user.pid}/standard.tga`,
					id: user.get('mii.image_id'),
					url: `${config.cdn.base_url}/mii/${user.pid}/standard.tga`,
					type: 'standard'
				}
			},
			name: user.get('mii.name'),
			primary: user.get('mii.primary') ? 'Y' : 'N',
		},
		region: user.get('region'),
		tz_name: user.get('timezone.name'),
		user_id: user.get('username'),
		utc_offset: user.get('timezone.offset')
	};
}

export async function getServer(gameServerId: string, accessMode: string): Promise<HydratedServerDocument> {
	return await Server.findOne({
		game_server_id: gameServerId,
		access_mode: accessMode
	});
}

export async function getServerByTitleId(titleId: string, accessMode: string): Promise<HydratedServerDocument> {
	return await Server.findOne({
		title_ids: titleId,
		access_mode: accessMode
	});
}

export async function addUserConnection(pnid: HydratedPNIDDocument, data: ConnectionData, type: string): Promise<ConnectionResponse> {
	if (type === 'discord') {
		return await addUserConnectionDiscord(pnid, data);
	}
}

export async function addUserConnectionDiscord(pnid: HydratedPNIDDocument, data: DiscordConnectionData): Promise<ConnectionResponse> {
	const valid: joi.ValidationResult = discordConnectionSchema.validate(data);

	if (valid.error) {
		return <ConnectionResponse>{
			app: 'api',
			status: 400,
			error: 'Invalid or missing connection data'
		};
	}

	await PNID.updateOne({ pid: pnid.get('pid') }, {
		$set: {
			'connections.discord.id': data.id
		}
	});

	return <ConnectionResponse>{
		app: 'api',
		status: 200
	};
}

export async function removeUserConnection(pnid: HydratedPNIDDocument, type: string): Promise<ConnectionResponse> {
	// * Add more connections later?
	if (type === 'discord') {
		return await removeUserConnectionDiscord(pnid);
	}
}

export async function removeUserConnectionDiscord(pnid: HydratedPNIDDocument): Promise<ConnectionResponse> {
	await PNID.updateOne({ pid: pnid.get('pid') }, {
		$set: {
			'connections.discord.id': ''
		}
	});

	return <ConnectionResponse>{
		app: 'api',
		status: 200
	};
}