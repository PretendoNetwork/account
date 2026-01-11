import { Schema, model } from 'mongoose';
import uniqueValidator from 'mongoose-unique-validator';
import type { IServer, IServerConnectInfo, IServerMethods, ServerModel } from '@/types/mongoose/server';

const ServerSchema = new Schema<IServer, ServerModel, IServerMethods>({
	client_id: String,
	ip: String,
	ipList: [String], // If specified, clients will be given a random IP from this list
	port: Number,
	service_name: String,
	service_type: String,
	game_server_id: String,
	title_ids: [String],
	access_mode: String,
	maintenance_mode: Boolean,
	device: Number,
	aes_key: String
});

ServerSchema.plugin(uniqueValidator, { message: '{PATH} already in use.' });

ServerSchema.method('getServerConnectInfo', async function (): Promise<IServerConnectInfo> {
	const ipList = (this.ipList ?? [this.ip]).filter((v): v is string => !!v);
	if (ipList.length === 0) {
		throw new Error(`No IP configured for server ${this._id}`);
	}

	const randomIp = ipList[Math.floor(Math.random() * ipList.length)];
	return {
		ip: randomIp,
		port: this.port
	};
});

export const Server = model<IServer, ServerModel>('Server', ServerSchema);
