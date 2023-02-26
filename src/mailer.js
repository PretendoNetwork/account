const nodemailer = require('nodemailer');
const { config, disabledFeatures } = require('./config-manager');
const path = require('path');
const fs = require("fs");
const genericEmailTemplate = fs.readFileSync(path.join(__dirname, './assets/emails/genericTemplate.html'), 'utf8');
const confirmationEmailTemplate = fs.readFileSync(path.join(__dirname, './assets/emails/confirmationTemplate.html'), 'utf8');

let transporter;

if (!disabledFeatures.email) {
	transporter = nodemailer.createTransport(config.email);
}

/**
	@param {Object} options
	@param {String} options.to The address of the recipient
	@param {String} options.subject The subject of the email

	@param {String} options.username The username of the user (shown in the greeting)
	@param {String} options.preview The preview text of the email (shown in the inbox by the email client)
	@param {String} options.text The text version of the email

	@param {String} options.paragraph The main content of the email

	@param {Object} options.confirmation Whether or not the email is a confirmation email
	@param {String} options.confirmation.href The link to the confirmation page
	@param {String} options.confirmation.code The confirmation code

	@param {Object} options.link An object containing the link to be shown in the email
	@param {String} options.link.href The URL of the link
	@param {String} options.link.text The text of the link
	
*/
async function sendMail(options) {
	if (!disabledFeatures.email) {
		const { to, subject, username, paragraph, preview, text, link, confirmation  } = options;
		
		let html = confirmation ? confirmationEmailTemplate : genericEmailTemplate;

		html = html.replace(/{{username}}/g, username);
		html = html.replace(/{{paragraph}}/g, paragraph);
		html = html.replace(/{{preview}}/g, (preview || ""));
		html = html.replace(/{{confirmation-href}}/g, (confirmation?.href || ""));
		html = html.replace(/{{confirmation-code}}/g, (confirmation?.code || ""));

		if (link) {
			const { href, text } = link;

			const button = `<tr><td width="100%" height="16px" style="line-height: 16px;">&nbsp;</td></tr><tr><td class="confirm-link" bgcolor="#673db6" style="font-size: 14px; font-weight: 700; border-radius: 10px; padding: 12px" align="center"><a href="${href}" style="text-decoration: none; color: #ffffff; " width="100%">${text}</a></td></tr>`
			html = html.replace(/<!--{{buttonPlaceholder}}-->/g, button);
		}

		await transporter.sendMail({
			from: config.email.from, 
			to,
			subject,
			text,
			html
		});
	}
}

module.exports = {
	sendMail
};
