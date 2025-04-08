import fs from 'fs-extra';
import colors from 'colors';

colors.enable();

const root = process.env.PN_ACT_LOGGER_PATH ? process.env.PN_ACT_LOGGER_PATH : `${__dirname}/..`;
fs.ensureDirSync(`${root}/logs`);

const streams = {
	latest: fs.createWriteStream(`${root}/logs/latest.log`),
	success: fs.createWriteStream(`${root}/logs/success.log`),
	error: fs.createWriteStream(`${root}/logs/error.log`),
	warn: fs.createWriteStream(`${root}/logs/warn.log`),
	info: fs.createWriteStream(`${root}/logs/info.log`)
} as const;

function getTimeStamp(): string {
	const time = new Date();
	const hours = String(time.getHours()).padStart(2, '0');
	const minutes = String(time.getMinutes()).padStart(2, '0');
	const seconds = String(time.getSeconds()).padStart(2, '0');

	return `[${hours}:${minutes}:${seconds}]`;
}

export function LOG_SUCCESS(input: string): void {
	const time = new Date();
	input = `[${getTimeStamp()}] [SUCCESS]: ${input}`;
	streams.success.write(`${input}\n`);

	console.log(`${input}`.green.bold);
}

export function LOG_ERROR(input: string): void {
	const time = new Date();
	input = `[${getTimeStamp()}] [ERROR]: ${input}`;
	streams.error.write(`${input}\n`);

	console.log(`${input}`.red.bold);
}

export function LOG_WARN(input: string): void {
	const time = new Date();
	input = `[${getTimeStamp()}] [WARN]: ${input}`;
	streams.warn.write(`${input}\n`);

	console.log(`${input}`.yellow.bold);
}

export function LOG_INFO(input: string): void {
	const time = new Date();
	input = `[${getTimeStamp()}] [INFO]: ${input}`;
	streams.info.write(`${input}\n`);

	console.log(`${input}`.cyan.bold);
}

export function formatHostnames(hostnames: string[]): string {
	return hostnames.map(d => `'${d}'`).join(', ');
}