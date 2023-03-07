import { Schema, model } from 'mongoose';
import uniqueValidator from 'mongoose-unique-validator';
import { IServer, IServerMethods, ServerModel } from '@/types/mongoose/server';

const ServerSchema = new Schema<IServer, ServerModel, IServerMethods>({
	ip: String, // Example: 1.1.1.1
	port: Number, // Example: 60000
	service_name: String, // Example: friends
	service_type: String, // Example: nex
	game_server_id: String, // Example: 00003200
	title_ids: [String], // Example: ["000500001018DB00", "000500001018DC00", "000500001018DD00"]
	access_mode: String, // Example: prod
	maintenance_mode: Boolean, // Example: false
	device: Number, // Example: 1 (WiiU)
});

ServerSchema.plugin(uniqueValidator, { message: '{PATH} already in use.' });

export const Server: ServerModel = model<IServer, ServerModel>('Server', ServerSchema);