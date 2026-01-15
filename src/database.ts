import crypto from 'node:crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import joi from 'joi';
import { nintendoPasswordHash } from '@/util';
import { OAuthToken } from '@/models/oauth_token';
import { PNID } from '@/models/pnid';
import { Server } from '@/models/server';
import { LOG_ERROR } from '@/logger';
import { config } from '@/config-manager';
import { TokenType } from '@/types/common/token-types';
import { SystemType } from '@/types/common/system-types';
import type { HydratedPNIDDocument } from '@/types/mongoose/pnid';
import type { IDeviceAttribute } from '@/types/mongoose/device-attribute';
import type { HydratedServerDocument } from '@/types/mongoose/server';
import type { PNIDProfile } from '@/types/services/nnas/pnid-profile';
import type { ConnectionData } from '@/types/services/api/connection-data';
import type { ConnectionResponse } from '@/types/services/api/connection-response';
import type { DiscordConnectionData } from '@/types/services/api/discord-connection-data';

const connection_string = config.mongoose.connection_string;
const options = config.mongoose.options;

// TODO - Extend this later with more settings
const discordConnectionSchema = joi.object({
	id: joi.string()
});

const accessModeOrder: Record<string, string[]> = {
	prod: ['prod'],
	test: ['test', 'prod'],
	dev: ['dev', 'test', 'prod']
};

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

export async function getPNIDByUsername(username: string): Promise<HydratedPNIDDocument | null> {
	verifyConnected();

	return await PNID.findOne<HydratedPNIDDocument>({
		usernameLower: username.toLowerCase()
	});
}

export async function getPNIDByPID(pid: number): Promise<HydratedPNIDDocument | null> {
	verifyConnected();

	return await PNID.findOne<HydratedPNIDDocument>({
		pid
	});
}

export async function getPNIDByEmailAddress(email: string): Promise<HydratedPNIDDocument | null> {
	verifyConnected();

	// TODO - Update documents to store email normalized
	return await PNID.findOne<HydratedPNIDDocument>({
		'email.address': email
	});
}

export async function doesPNIDExist(username: string): Promise<boolean> {
	verifyConnected();

	return !!await getPNIDByUsername(username);
}

export async function getPNIDByBasicAuth(token: string): Promise<HydratedPNIDDocument | null> {
	verifyConnected();

	// * Wii U sends Basic auth as `username password`, where the password may not have spaces
	// * This is not to spec, but that is the consoles fault not ours
	const decoded = Buffer.from(token, 'base64').toString();
	const parts = decoded.split(' ');

	const username = parts[0];
	const password = parts[1];

	const pnid = await getPNIDByUsername(username);

	if (!pnid) {
		return null;
	}

	const hashedPassword = nintendoPasswordHash(password, pnid.pid);

	if (!bcrypt.compareSync(hashedPassword, pnid.password)) {
		return null;
	}

	return pnid;
}

async function getPNIDByOAuthToken(token: string, expectedSystemType: SystemType, expectedTokenType: TokenType): Promise<HydratedPNIDDocument | null> {
	verifyConnected();

	try {
		const oauthToken = await OAuthToken.findOne({
			token: crypto.createHash('sha256').update(token).digest('hex')
		});

		if (!oauthToken) {
			return null;
		}

		if (oauthToken.info.system_type !== expectedSystemType) {
			return null;
		}

		if (oauthToken.info.token_type !== expectedTokenType) {
			return null;
		}

		const pnid = await getPNIDByPID(oauthToken.pid);

		if (pnid) {
			const expireTime = Math.floor((Number(oauthToken.info.expires) / 1000));

			if (Math.floor(Date.now() / 1000) > expireTime) {
				return null;
			}
		}

		// * Refresh tokens are single use
		if (expectedTokenType === TokenType.OAuthRefresh) {
			await oauthToken.deleteOne();
		}

		return pnid;
	} catch (error: any) {
		// TODO - Handle error
		LOG_ERROR(error);
		return null;
	}
}

export async function getPNIDByNNASAccessToken(token: string): Promise<HydratedPNIDDocument | null> {
	return getPNIDByOAuthToken(token, SystemType.WUP, TokenType.OAuthAccess);
}

export async function getPNIDByNNASRefreshToken(token: string): Promise<HydratedPNIDDocument | null> {
	return getPNIDByOAuthToken(token, SystemType.WUP, TokenType.OAuthRefresh);
}

export async function getPNIDByAPIAccessToken(token: string): Promise<HydratedPNIDDocument | null> {
	return getPNIDByOAuthToken(token, SystemType.API, TokenType.OAuthAccess);
}

export async function getPNIDByAPIRefreshToken(token: string): Promise<HydratedPNIDDocument | null> {
	return getPNIDByOAuthToken(token, SystemType.API, TokenType.OAuthRefresh);
}

export async function getPNIDProfileJSONByPID(pid: number): Promise<PNIDProfile | null> {
	verifyConnected();

	const pnid = await getPNIDByPID(pid);

	if (!pnid) {
		return null;
	}

	const device = pnid.devices[0]; // * Just grab the first device
	let device_attributes: {
		device_attribute: {
			name: string;
			value: string;
			created_date: string;
		};
	}[] = [];

	if (device) {
		device_attributes = device.device_attributes.map((attribute: IDeviceAttribute) => {
			const name = attribute.name;
			const value = attribute.value;
			const created_date = attribute.created_date;

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
		// *accounts: {}, // * We need to figure this out, no idea what these values mean or what they do
		active_flag: pnid.flags.active ? 'Y' : 'N',
		birth_date: pnid.birthdate,
		country: pnid.country,
		create_date: pnid.creation_date,
		device_attributes: device_attributes,
		gender: pnid.gender,
		language: pnid.language,
		updated: pnid.updated,
		marketing_flag: pnid.flags.marketing ? 'Y' : 'N',
		off_device_flag: pnid.flags.off_device ? 'Y' : 'N',
		pid: pnid.pid,
		email: {
			address: pnid.email.address,
			id: pnid.email.id,
			parent: pnid.email.parent ? 'Y' : 'N',
			primary: pnid.email.primary ? 'Y' : 'N',
			reachable: pnid.email.reachable ? 'Y' : 'N',
			type: 'DEFAULT',
			updated_by: 'USER', // * Can also be INTERNAL WS, don't know the difference
			validated: pnid.email.validated ? 'Y' : 'N',
			validated_date: pnid.email.validated ? pnid.email.validated_date : ''
		},
		mii: {
			status: 'COMPLETED',
			data: pnid.mii.data.replace(/(\r\n|\n|\r)/gm, ''),
			id: pnid.mii.id,
			mii_hash: pnid.mii.hash,
			mii_images: {
				mii_image: {
					// * Images MUST be loaded over HTTPS or console ignores them
					// * Bunny CDN is the only CDN which seems to support TLS 1.0/1.1 (required)
					cached_url: `${config.cdn.base_url}/mii/${pnid.pid}/standard.tga`,
					id: pnid.mii.image_id,
					url: `${config.cdn.base_url}/mii/${pnid.pid}/standard.tga`,
					type: 'standard'
				}
			},
			name: pnid.mii.name,
			primary: pnid.mii.primary ? 'Y' : 'N'
		},
		region: pnid.region,
		tz_name: pnid.timezone.name,
		user_id: pnid.username,
		utc_offset: pnid.timezone.offset
	};
}

export async function getServerByGameServerID(gameServerID: string, accessMode: string): Promise<HydratedServerDocument | null> {
	const searchModes = accessModeOrder[accessMode] ?? accessModeOrder.prod; // Default to prod if invalid mode

	const servers = await Server.find({
		game_server_id: gameServerID,
		access_mode: { $in: searchModes }
	});

	for (const mode of searchModes) {
		const server = servers.find(s => s.access_mode === mode);
		if (server) {
			return server;
		}
	}

	return null;
}

export async function getServerByTitleID(titleID: string, accessMode: string): Promise<HydratedServerDocument | null> {
	const searchModes = accessModeOrder[accessMode] ?? accessModeOrder.prod;

	const servers = await Server.find({
		title_ids: titleID,
		access_mode: { $in: searchModes }
	});

	for (const mode of searchModes) {
		const server = servers.find(s => s.access_mode === mode);
		if (server) {
			return server;
		}
	}

	return null;
}

export async function getServerByClientID(clientID: string, accessMode: string): Promise<HydratedServerDocument | null> {
	const searchModes = accessModeOrder[accessMode] ?? accessModeOrder.prod;

	const servers = await Server.find({
		client_id: clientID,
		access_mode: { $in: searchModes }
	});

	for (const mode of searchModes) {
		const server = servers.find(s => s.access_mode === mode);
		if (server) {
			return server;
		}
	}

	return null;
}

export async function addPNIDConnection(pnid: HydratedPNIDDocument, data: ConnectionData, type: string): Promise<ConnectionResponse | undefined> {
	if (type === 'discord') {
		return await addPNIDConnectionDiscord(pnid, data);
	}
}

export async function addPNIDConnectionDiscord(pnid: HydratedPNIDDocument, data: DiscordConnectionData): Promise<ConnectionResponse> {
	const valid = discordConnectionSchema.validate(data);

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

export async function removePNIDConnection(pnid: HydratedPNIDDocument, type: string): Promise<ConnectionResponse | undefined> {
	// * Add more connections later?
	if (type === 'discord') {
		return await removePNIDConnectionDiscord(pnid);
	}
}

export async function removePNIDConnectionDiscord(pnid: HydratedPNIDDocument): Promise<ConnectionResponse> {
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
