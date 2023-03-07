import fs from 'fs-extra';
import colors from 'colors';

colors.enable();

const root: string = process.env.PN_ACT_LOGGER_PATH ? process.env.PN_ACT_LOGGER_PATH : `${__dirname}/..`;
fs.ensureDirSync(`${root}/logs`);

const streams: { [key: string]: fs.WriteStream } = {
	latest: fs.createWriteStream(`${root}/logs/latest.log`),
	success: fs.createWriteStream(`${root}/logs/success.log`),
	error: fs.createWriteStream(`${root}/logs/error.log`),
	warn: fs.createWriteStream(`${root}/logs/warn.log`),
	info: fs.createWriteStream(`${root}/logs/info.log`)
};

function success(input: string): void {
	const time: Date = new Date();
	input = `[${time.getHours()}:${time.getMinutes()}:${time.getSeconds()}] [SUCCESS]: ${input}`;
	streams.success.write(`${input}\n`);

	console.log(`${input}`.green.bold);
}

function error(input: string): void {
	const time: Date = new Date();
	input = `[${time.getHours()}:${time.getMinutes()}:${time.getSeconds()}] [ERROR]: ${input}`;
	streams.error.write(`${input}\n`);

	console.log(`${input}`.red.bold);
}

function warn(input: string): void {
	const time: Date = new Date();
	input = `[${time.getHours()}:${time.getMinutes()}:${time.getSeconds()}] [WARN]: ${input}`;
	streams.warn.write(`${input}\n`);

	console.log(`${input}`.yellow.bold);
}

function info(input: string): void {
	const time: Date = new Date();
	input = `[${time.getHours()}:${time.getMinutes()}:${time.getSeconds()}] [INFO]: ${input}`;
	streams.info.write(`${input}\n`);

	console.log(`${input}`.cyan.bold);
}

export default {
	success,
	error,
	warn,
	info
};