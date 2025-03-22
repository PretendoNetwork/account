import { Model, HydratedDocument } from 'mongoose';

export interface IServer {
	client_id: string;
	ip: string;
	port: number;
	service_name: string;
	service_type: string;
	game_server_id: string;
	title_ids: string[];
	access_mode: string;
	maintenance_mode: boolean;
	device: number;
	aes_key: string;
}

export interface IServerMethods {}

interface IServerQueryHelpers {}

export interface ServerModel extends Model<IServer, IServerQueryHelpers, IServerMethods> {}

export type HydratedServerDocument = HydratedDocument<IServer, IServerMethods>