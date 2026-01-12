import dgram from 'node:dgram';
import crypto from 'node:crypto';
import { Schema, model } from 'mongoose';
import uniqueValidator from 'mongoose-unique-validator';
import { LOG_WARN } from '@/logger';
import type { IServer, IServerConnectInfo, IServerMethods, ServerModel } from '@/types/mongoose/server';

// * Kinda ugly to slap this in with the Mongoose stuff but it's fine for now
// TODO - Maybe move this one day?
const socket = dgram.createSocket('udp4');
const pendingHealthCheckRequests = new Map<string, () => void>();

socket.on('message', (msg: Buffer, _rinfo: dgram.RemoteInfo) => {
	const uuid = msg.toString();
	const resolve = pendingHealthCheckRequests.get(uuid);

	if (resolve) {
		resolve();
	}
});

socket.bind();

function healthCheck(target: { host: string; port: number }): Promise<string> {
	return new Promise((resolve, reject) => {
		const uuid = crypto.randomUUID();

		const timeout = setTimeout(() => {
			pendingHealthCheckRequests.delete(uuid);
			reject(new Error('No valid response received'));
		}, 2 * 1000); // TODO - Make this configurable? 2 seconds seems fine for now

		pendingHealthCheckRequests.set(uuid, () => {
			clearTimeout(timeout);
			pendingHealthCheckRequests.delete(uuid);
			resolve(target.host);
		});

		socket.send(Buffer.from(uuid), target.port, target.host, (error) => {
			if (error) {
				clearTimeout(timeout);
				pendingHealthCheckRequests.delete(uuid);
				reject(error);
			}
		});
	});
}

const ServerSchema = new Schema<IServer, ServerModel, IServerMethods>({
	client_id: String,
	ip: {
		type: String,
		required: false
	},
	ip_list: {
		type: [String],
		required: false
	},
	port: Number,
	service_name: String,
	service_type: String,
	game_server_id: String,
	title_ids: [String],
	access_mode: String,
	maintenance_mode: Boolean,
	device: Number,
	aes_key: String,
	health_check_port: {
		type: Number,
		required: false
	}
});

ServerSchema.plugin(uniqueValidator, { message: '{PATH} already in use.' });

ServerSchema.method('getServerConnectInfo', async function (): Promise<IServerConnectInfo> {
	const ipList = [this.ip_list, this.ip].flat().filter((v): v is string => !!v);
	if (ipList.length === 0) {
		throw new Error(`No IP configured for server ${this._id}`);
	}

	const randomIP = ipList[Math.floor(Math.random() * ipList.length)];

	if (!this.health_check_port) {
		return {
			ip: randomIP,
			port: this.port
		};
	}

	// * Remove the random IP from the race pool to remove the duplicate health check
	const healthCheckTargets = ipList.filter(ip => ip !== randomIP).map(ip => ({
		host: ip,
		port: this.health_check_port!
	}));

	// * Default to the random IP in case nothing responded in time
	// * and just Hope For The Best:tm:
	let target = randomIP;

	// * Check the random IP and start the race at the same time, preferring
	// * the result of the random IP should it succeed. Worst case scenario
	// * this takes 2 seconds to complete
	const [randomResult, raceResult] = await Promise.allSettled([
		healthCheck({ host: randomIP, port: this.health_check_port! }),
		Promise.race(healthCheckTargets.map(target => healthCheck(target)))
	]);

	if (randomResult.status === 'rejected') {
		if (raceResult.status === 'fulfilled') {
			target = raceResult.value;
		} else {
			LOG_WARN(`Server ${this.service_name} failed to find healthy NEX server. Using the randomly selected IP ${target}`);
		}
	}

	return {
		ip: target,
		port: this.port
	};
});

export const Server = model<IServer, ServerModel>('Server', ServerSchema);
