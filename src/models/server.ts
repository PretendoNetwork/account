import { Schema, model } from 'mongoose';
import uniqueValidator from 'mongoose-unique-validator';
import { IServer, IServerMethods, ServerModel } from '@/types/mongoose/server';
import type { SystemType } from '@/types/common/token';

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

export const Server = model<IServer, ServerModel>('Server', ServerSchema);

export const serverDeviceToSystemType: Record<number, SystemType> = {
	1: 'WIIU',
	2: '3DS'
};