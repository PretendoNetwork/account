import { Schema, model } from 'mongoose';
import uniqueValidator from 'mongoose-unique-validator';
import { IServer, IServerMethods, ServerModel } from '@/types/mongoose/server';

const ServerSchema = new Schema<IServer, ServerModel, IServerMethods>({
	client_id: String,
	ip: String,
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

export const Server: ServerModel = model<IServer, ServerModel>('Server', ServerSchema);