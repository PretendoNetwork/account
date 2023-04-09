const fs = require('fs-extra');
const { createWriteStream } = require('fs');
const { join } = require('path');
const colors = require('colors');

const LOG_DIRECTORY = join(__dirname, 'logs');

fs.ensureDirSync(LOG_DIRECTORY);

const streams = {
  latest: createWriteStream(join(LOG_DIRECTORY, 'latest.log'), { flags: 'a' }),
  success: createWriteStream(join(LOG_DIRECTORY, 'success.log'), { flags: 'a' }),
  error: createWriteStream(join(LOG_DIRECTORY, 'error.log'), { flags: 'a' }),
  warn: createWriteStream(join(LOG_DIRECTORY, 'warn.log'), { flags: 'a' }),
  info: createWriteStream(join(LOG_DIRECTORY, 'info.log'), { flags: 'a' }),
};

function log(type, message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${type.toUpperCase()}]: ${message}`;
  
  streams[type].write(`${logMessage}\n`);
  console.log(colors[type](logMessage));
}

module.exports = {
  success: (message) => log('success', message),
  error: (message) => log('error', message),
  warn: (message) => log('warn', message),
  info: (message) => log('info', message),
};
