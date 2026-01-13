import type { Model, HydratedDocument } from 'mongoose';

export interface IServer {
	client_id: string;
	ip?: string;
	ip_list?: string[];
	port: number;
	service_name: string;
	service_type: string;
	game_server_id: string;
	title_ids: string[];
	access_mode: string;
	maintenance_mode: boolean;
	device: number;
	aes_key: string;
	health_check_port?: number;
}

export interface IServerConnectInfo {
	ip: string;
	port: number;
}

export interface IServerMethods {
	getServerConnectInfo(): Promise<IServerConnectInfo>;
}

interface IServerQueryHelpers {}

export interface ServerModel extends Model<IServer, IServerQueryHelpers, IServerMethods> {}

export type HydratedServerDocument = HydratedDocument<IServer, IServerMethods>;
