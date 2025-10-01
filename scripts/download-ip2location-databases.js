const { pipeline } = require('node:stream/promises');
const fs = require('node:fs');
const path = require('node:path');
const yauzl = require('yauzl-promise');

require('dotenv').config();

const databases = {
	DB3LITEBIN: {
		file_name: 'IP2LOCATION-LITE-DB3.BIN',
		save_path: path.join(__dirname, '..', 'dist', 'IP2LOCATION-LITE-DB3.IPV4.BIN')
	},
	DB3LITEBINIPV6: {
		file_name: 'IP2LOCATION-LITE-DB3.IPV6.BIN',
		save_path: path.join(__dirname, '..', 'dist', 'IP2LOCATION-LITE-DB3.IPV6.BIN')
	}
};

async function main() {
	if (!process.env.PN_ACT_CONFIG_IP2LOCATION_TOKEN) {
		// * Optional
		return;
	}

	for (const name in databases) {
		const database = databases[name];
		const response = await fetch(`https://www.ip2location.com/download/?token=${process.env.PN_ACT_CONFIG_IP2LOCATION_TOKEN}&file=${name}`);
		const arrayBuffer = await response.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);
		const zip = await yauzl.fromBuffer(buffer);

		try {
			for await (const entry of zip) {
				if (entry.filename === database.file_name) {
					const readStream = await entry.openReadStream();
					const writeStream = fs.createWriteStream(database.save_path);

					await pipeline(readStream, writeStream);
				}
			}
		} catch (error) {
			console.error('Error downloading IP2Location databases:', error);
		}
	}
}

main();
