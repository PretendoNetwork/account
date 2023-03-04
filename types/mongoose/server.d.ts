import { Model } from 'mongoose';

declare global {
	interface IServer {
		ip: string; // Example: 1.1.1.1
		port: Number; // Example: 60000
		service_name: string; // Example: friends
		service_type: string; // Example: nex
		game_server_id: string; // Example: 00003200
		title_ids: string[]; // Example: ["000500001018DB00", "000500001018DC00", "000500001018DD00"]
		access_mode: string; // Example: prod
		maintenance_mode: boolean; // Example: false
		device: number; // Example: 1 (WiiU)
	}

	interface IServerMethods {}

	interface ServerModel extends Model<IServer, {}, IServerMethods> {}
}