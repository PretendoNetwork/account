const nodemailer = require('nodemailer');
const config = require('../config.json');

const transporter = nodemailer.createTransport(config.email);

/**
 * Sends an email with the specified subject and message to an email address
 * @param {String} email the destination email address
 * @param {String} subject The Subject of the email
 * @param {String} message The body of the email
 */
async function send(email, subject = 'No email subject provided', message = 'No email body provided') {
	const options = {
		from: config.email.auth.user,
		to: email,
		subject: subject,
		html: message
	};

	return new Promise(resolve => {
		transporter.sendMail(options, (error) => {
			if (error) {
				console.warn(error);
			}

			return resolve();
		});
	});
}

module.exports = {
	send: send
};