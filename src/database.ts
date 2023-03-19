import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import joi from 'joi';
import { nintendoPasswordHash, decryptToken, unpackToken } from '@/util';
import { PNID } from '@/models/pnid';
import { Server } from '@/models/server';
import { LOG_ERROR } from '@/logger';
import { config } from '@/config-manager';
import { HydratedPNIDDocument } from '@/types/mongoose/pnid';
import { IDevice } from '@/types/mongoose/device';
import { IDeviceAttribute } from '@/types/mongoose/device-attribute';
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

export async function getUserByUsername(username: string): Promise<HydratedPNIDDocument | null> {
	verifyConnected();

	return await PNID.findOne<HydratedPNIDDocument>({
		usernameLower: username.toLowerCase()
	});
}

export async function getUserByPID(pid: number): Promise<HydratedPNIDDocument | null> {
	verifyConnected();

	return await PNID.findOne<HydratedPNIDDocument>({
		pid
	});
}

export async function getUserByEmailAddress(email: string): Promise<HydratedPNIDDocument | null> {
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

export async function getUserBasic(token: string): Promise<HydratedPNIDDocument | null> {
	verifyConnected();

	// * Wii U sends Basic auth as `username password`, where the password may not have spaces
	// * This is not to spec, but that is the consoles fault not ours
	const decoded: string = Buffer.from(token, 'base64').toString();
	const parts: string[] = decoded.split(' ');

	const username: string = parts[0];
	const password: string = parts[1];

	const user: HydratedPNIDDocument | null = await getUserByUsername(username);

	if (!user) {
		return null;
	}

	const hashedPassword: string = nintendoPasswordHash(password, user.pid);

	if (!bcrypt.compareSync(hashedPassword, user.password)) {
		return null;
	}

	return user;
}

export async function getUserBearer(token: string): Promise<HydratedPNIDDocument | null> {
	verifyConnected();

	try {
		const decryptedToken: Buffer = await decryptToken(Buffer.from(token, 'base64'));
		const unpackedToken: Token = unpackToken(decryptedToken);

		const user: HydratedPNIDDocument | null = await getUserByPID(unpackedToken.pid);

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

export async function getUserProfileJSONByPID(pid: number): Promise<PNIDProfile | null> {
	verifyConnected();

	const user: HydratedPNIDDocument | null = await getUserByPID(pid);

	if (!user) {
		return null;
	}

	const device: IDevice = user.devices[0]; // * Just grab the first device
	let device_attributes: {
		device_attribute: {
			name: string;
			value: string;
			created_date: string;
		};
	}[] = [];

	if (device) {
		device_attributes = device.device_attributes.map((attribute: IDeviceAttribute) => {
			const name: string = attribute.name;
			const value: string = attribute.value;
			const created_date: string | undefined = attribute.created_date;

			return {
				device_attribute: {
					name,
					value,
					created_date: created_date ? created_date : ''
				}
			};
		});
	}

	return {
		//accounts: {}, // * We need to figure this out, no idea what these values mean or what they do
		active_flag: user.flags.active ? 'Y' : 'N',
		birth_date: user.birthdate,
		country: user.country,
		create_date: user.creation_date,
		device_attributes: device_attributes,
		gender: user.gender,
		language: user.language,
		updated: user.updated,
		marketing_flag: user.flags.marketing ? 'Y' : 'N',
		off_device_flag: user.flags.off_device ? 'Y' : 'N',
		pid: user.pid,
		email: {
			address: user.email.address,
			id: user.email.id,
			parent: user.email.parent ? 'Y' : 'N',
			primary: user.email.primary ? 'Y' : 'N',
			reachable: user.email.reachable ? 'Y' : 'N',
			type: 'DEFAULT',
			updated_by: 'USER', // * Can also be INTERNAL WS, don't know the difference
			validated: user.email.validated ? 'Y' : 'N',
			validated_date: user.email.validated ? user.email.validated_date : ''
		},
		mii: {
			status: 'COMPLETED',
			data: user.mii.data.replace(/(\r\n|\n|\r)/gm, ''),
			id: user.mii.id,
			mii_hash: user.mii.hash,
			mii_images: {
				mii_image: {
					// * Images MUST be loaded over HTTPS or console ignores them
					// * Bunny CDN is the only CDN which seems to support TLS 1.0/1.1 (required)
					cached_url: `${config.cdn.base_url}/mii/${user.pid}/standard.tga`,
					id: user.mii.image_id,
					url: `${config.cdn.base_url}/mii/${user.pid}/standard.tga`,
					type: 'standard'
				}
			},
			name: user.mii.name,
			primary: user.mii.primary ? 'Y' : 'N',
		},
		region: user.region,
		tz_name: user.timezone.name,
		user_id: user.username,
		utc_offset: user.timezone.offset
	};
}

export async function getServer(gameServerId: string, accessMode: string): Promise<HydratedServerDocument | null> {
	return await Server.findOne({
		game_server_id: gameServerId,
		access_mode: accessMode
	});
}

export async function getServerByTitleId(titleId: string, accessMode: string): Promise<HydratedServerDocument | null> {
	return await Server.findOne({
		title_ids: titleId,
		access_mode: accessMode
	});
}

export async function addUserConnection(pnid: HydratedPNIDDocument, data: ConnectionData, type: string): Promise<ConnectionResponse | undefined> {
	if (type === 'discord') {
		return await addUserConnectionDiscord(pnid, data);
	}
}

export async function addUserConnectionDiscord(pnid: HydratedPNIDDocument, data: DiscordConnectionData): Promise<ConnectionResponse> {
	const valid: joi.ValidationResult = discordConnectionSchema.validate(data);

	if (valid.error) {
		return {
			app: 'api',
			status: 400,
			error: 'Invalid or missing connection data'
		};
	}

	await PNID.updateOne({ pid: pnid.pid }, {
		$set: {
			'connections.discord.id': data.id
		}
	});

	return {
		app: 'api',
		status: 200
	};
}

export async function removeUserConnection(pnid: HydratedPNIDDocument, type: string): Promise<ConnectionResponse | undefined> {
	// * Add more connections later?
	if (type === 'discord') {
		return await removeUserConnectionDiscord(pnid);
	}
}

export async function removeUserConnectionDiscord(pnid: HydratedPNIDDocument): Promise<ConnectionResponse> {
	await PNID.updateOne({ pid: pnid.pid }, {
		$set: {
			'connections.discord.id': ''
		}
	});

	return {
		app: 'api',
		status: 200
	};
}