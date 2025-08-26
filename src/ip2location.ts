import path from 'node:path';
import net from 'node:net';
import * as IP2Location from 'ip2location-nodejs';

class IP2LocationManager {
	private ipv4: IP2Location.IP2Location;
	private ipv6: IP2Location.IP2Location;

	constructor() {
		this.ipv4 = new IP2Location.IP2Location();
		this.ipv6 = new IP2Location.IP2Location();

		this.ipv4.open(path.join(__dirname, 'IP2LOCATION-LITE-DB3.IPV4.BIN'));
		this.ipv6.open(path.join(__dirname, 'IP2LOCATION-LITE-DB3.IPV6.BIN'));
	}

	public lookup(ip: string): { country: string; region: string } | null {
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
