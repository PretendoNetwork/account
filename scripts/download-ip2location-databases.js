const { Readable } = require('node:stream');
const fs = require('node:fs');
const path = require('node:path');
const unzipper = require('unzipper');

require('dotenv').config();

// * unzipper wants to use the "request" module, which is deprecated and insecure.
// * Just wrap native fetch to avoid another dependancy here
// TODO - This is kinda ugly, can this be better?
function request(options) {
	const url = typeof options === 'string' ? options : options.url;
	const headers = options.headers || {};

	const stream = new Readable({
		read() {} // * Noop. Push data manually
	});

	fetch(url, { headers }).then((response) => {
		if (!response.ok) {
			const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
			error.statusCode = response.status;

			stream.emit('error', error);

			return;
		}

		stream.emit('response', {
			statusCode: response.status,
			headers: Object.fromEntries(response.headers.entries())
		});

		const reader = response.body.getReader();

		function pump() {
			reader.read().then(({ done, value }) => {
				if (done) {
					stream.push(null);
				} else {
					stream.push(Buffer.from(value));
					pump();
				}
			}).catch((error) => {
				stream.emit('error', error);
			});
		}

		pump();
	}).catch((error) => {
		stream.emit('error', error);
	});

	stream.abort = function () {
		stream.destroy();
	};

	return stream;
}

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
	for (const name in databases) {
		const database = databases[name];
		const directory = await unzipper.Open.url(request, `https://www.ip2location.com/download/?token=${process.env.PN_ACT_CONFIG_IP2LOCATION_TOKEN}&file=${name}`);
		const file = directory.files.find(file => file.path === database.file_name);
		const content = await file.buffer();
		fs.writeFileSync(database.save_path, content);
	}
}

main();
