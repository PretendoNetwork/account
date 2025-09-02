import path from 'node:path';
import net from 'node:net';
import fs from 'fs-extra';
import * as IP2Location from 'ip2location-nodejs';
import { LOG_WARN } from '@/logger';

class IP2LocationManager {
	private ipv4?: IP2Location.IP2Location;
	private ipv6?: IP2Location.IP2Location;

	constructor() {
		const ipv4Path = path.join(__dirname, 'IP2LOCATION-LITE-DB3.IPV4.BIN');
		const ipv6Path = path.join(__dirname, 'IP2LOCATION-LITE-DB3.IPV6.BIN');

		if (!fs.existsSync(ipv4Path)) {
			LOG_WARN('Could not find IP2LOCATION-LITE-DB3.IPV4.BIN. IP location checking disabled. To enable, run `node scripts/download-ip2location-databases.js` and restart the server.');
		} else {
			this.ipv4 = new IP2Location.IP2Location();
			this.ipv4.open(ipv4Path);
		}

		if (!fs.existsSync(ipv6Path)) {
			LOG_WARN('Could not find IP2LOCATION-LITE-DB3.IPV6.BIN. IP location checking disabled. To enable, run `node scripts/download-ip2location-databases.js` and restart the server.');
		} else {
			this.ipv6 = new IP2Location.IP2Location();
			this.ipv6.open(ipv6Path);
		}
	}

	public lookup(ip: string): { country: string; region: string } | null {
		if (!this.ipv4 || !this.ipv6) {
			return null;
		}

		const ipVersion = net.isIP(ip);
		let result;

		if (ipVersion === 4) {
			result = this.ipv4.getAll(ip);
		} else if (ipVersion === 6) {
			result = this.ipv6.getAll(ip);
		} else {
			return null;
		}

		return {
			country: result.countryShort,
			region: result.region
		};
	}
}

const manager = new IP2LocationManager();

export default manager;
