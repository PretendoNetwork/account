const nodemailer = require('nodemailer');
const config = require('./config');

const transporter = nodemailer.createTransport({
	service: 'gmail',
	auth: {
		user: config.email.address,
		pass: config.email.password
	}
});

/**
 * Sends an email with the specified subject and message to an email address
 * @param {String} email the destination email address
 * @param {String} subject The Subject of the email
 * @param {String} message The body of the email
 */
function send(email, subject = 'No email subject provided', message = 'No email body provided') {
	const options = {
		from: config.email.address,
		to: email,
		subject: subject,
		html: message
	};

	transporter.sendMail(options, (error, info) => {
		if (error) {
			console.log(error);
		} else {
			console.log(info);
		}
	});
}

module.exports = {
	send: send
};
