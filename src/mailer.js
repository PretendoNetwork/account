const nodemailer = require('nodemailer');
const { config, disabledFeatures } = require('./config-manager');
const path = require('path');
const fs = require("fs");
const genericEmailTemplate = fs.readFileSync(path.join(__dirname, './assets/emails/genericTemplate.html'), 'utf8');

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

/**
	@param {Object} options
	@param {String} options.to The address to send the email to
	@param {String} options.subject The subject of the email
	@param {String} options.username The username of the user (shown in the greeting)
	@param {String} options.paragraph The main content of the email
	@param {String} options.preview The preview text of the email (shown in the inbox by the email client)
*/
async function sendHtmlMail(options) {
	if (!disabledFeatures.email) {
		const { to, subject, username, paragraph, preview } = options;
		
		let html = genericEmailTemplate;

		html = html.replace(/{{username}}/g, username);
		html = html.replace(/{{paragraph}}/g, paragraph);
		html = html.replace(/{{preview}}/g, preview);

		const transporterOptions = {
			to,
			subject,
			html
		}
		await transporter.sendMail(transporterOptions);
	}
}


module.exports = {
	sendMail,
	sendHtmlMail
};
