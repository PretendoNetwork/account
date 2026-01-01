import fs from 'node:fs/promises';
import { z } from 'zod';
import mongoose from 'mongoose';
import { config, disabledFeatures } from './config-manager';
import { LOG_INFO, LOG_WARN } from './logger';
import { Server } from './models/server';

// Provisioning has a couple edgecases:
// - It will only update existing entries, will not add new one
// - Only the fields in the below schema will be updated

const serverProvisioningSchema = z.object({
	servers: z.array(z.object({
		id: z.string(),
		name: z.string(),
		ip: z.string(),
		port: z.coerce.number()
	}))
});

async function readServerProvisioning(configPath: string): Promise<z.infer<typeof serverProvisioningSchema>> {
	const fileContents = await fs.readFile(configPath, 'utf-8');
	const parsedConfig = JSON.parse(fileContents);
	return serverProvisioningSchema.parse(parsedConfig);
}

export async function handleServerProvisioning(): Promise<void> {
	const serverData = await readServerProvisioning(config.provisioning.server_config).catch((err) => {
		LOG_WARN('Failed to parse server provisioning config:');
		console.error(err);
	});
	if (!serverData) {
		return;
	}

	LOG_INFO('Starting server provisioning');
	for (const server of serverData.servers) {
		const id = new mongoose.Types.ObjectId(server.id);
		const result = await Server.findOneAndUpdate(id, {
			$set: {
				_id: id,
				service_name: server.name,
				ip: server.ip,
				port: server.port
			}
		});
		if (!result) {
			LOG_WARN(`Could not find existing server DB entry for ID ${server.id} - skipping provisioning`);
		}
	}
	LOG_INFO(`Finished provisioning ${serverData.servers.length} servers`);
}

export function startProvisioner(): void {
	if (disabledFeatures.serverProvisioning) {
		return;
	}

	const runProvisioning = (): void => {
		handleServerProvisioning().catch((err) => {
			LOG_WARN('Failed to provision servers:');
			console.error(err);
		});
	};

	// Run once at boot
	runProvisioning();

	(async (): Promise<void> => {
		const watcher = fs.watch(config.provisioning.server_config);
		// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Dont need this var
		for await (const _ of watcher) {
			LOG_INFO('Detected a change in the server provisioning config');
			runProvisioning();
		}
	})();
}
