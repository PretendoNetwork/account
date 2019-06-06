const fs = require('fs-extra');
require('colors');

class Logger {
	constructor(root = '') {
		fs.ensureDirSync(`${root}/logs`);

		this.root = root;
		this.streams = {
			latest: fs.createWriteStream(`${this.root}/logs/latest.log`, {flags: 'a'}),
			success: fs.createWriteStream(`${this.root}/logs/success.log`, {flags: 'a'}),
			error: fs.createWriteStream(`${this.root}/logs/error.log`, {flags: 'a'}),
			warn: fs.createWriteStream(`${this.root}/logs/warn.log`, {flags: 'a'}),
			info: fs.createWriteStream(`${this.root}/logs/info.log`, {flags: 'a'})
		};

		this.streams.info.bytesWritten = 10;
	}
	

	success(input) {
		const time = new Date();
		input = `[${time.getHours()}:${time.getMinutes()}:${time.getSeconds()}] [SUCCESS]: ${input}`;
		this.streams.success.write(`${input}\n`);

		console.log(`${input}`.green.bold);
	}

	error(input) {
		const time = new Date();
		input = `[${time.getHours()}:${time.getMinutes()}:${time.getSeconds()}] [ERROR]: ${input}`;
		this.streams.error.write(`${input}\n`);

		console.log(`${input}`.red.bold);
	}

	warn(input) {
		const time = new Date();
		input = `[${time.getHours()}:${time.getMinutes()}:${time.getSeconds()}] [WARN]: ${input}`;
		this.streams.warn.write(`${input}\n`);

		console.log(`${input}`.yellow.bold);
	}

	info(input) {
		const time = new Date();
		input = `[${time.getHours()}:${time.getMinutes()}:${time.getSeconds()}] [INFO]: ${input}`;
		this.streams.info.write(`${input}\n`);

		console.log(`${input}`.cyan.bold);
	}
}

const logger = new Logger(process.cwd());

module.exports = logger;