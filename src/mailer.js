const nodemailer = require('nodemailer');
const { config, disabledFeatures } = require('./config-manager');

let transporter;

if (!disabledFeatures.email) {
	transporter = nodemailer.createTransport(config.email);
}

async function sendMail(options) {
	if (!disabledFeatures.email) {
		options.from = config.email.from;

		await transporter.sendMail(options);
	}
}

module.exports = {
	sendMail
};
