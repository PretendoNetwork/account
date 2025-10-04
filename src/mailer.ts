import path from 'node:path';
import fs from 'node:fs';
import nodemailer from 'nodemailer';
import * as aws from '@aws-sdk/client-ses';
import { config, disabledFeatures } from '@/config-manager';
import type { MailerOptions } from '@/types/common/mailer-options';

const genericEmailTemplate = fs.readFileSync(path.join(__dirname, './assets/emails/genericTemplate.html'), 'utf8');
const confirmationEmailTemplate = fs.readFileSync(path.join(__dirname, './assets/emails/confirmationTemplate.html'), 'utf8');

let transporter: nodemailer.Transporter;

if (!disabledFeatures.email) {
	const ses = new aws.SES({
		apiVersion: '2010-12-01',
		region: config.email.ses.region,
		credentials: {
			accessKeyId: config.email.ses.key,
			secretAccessKey: config.email.ses.secret
		}
	});

	transporter = transporter = nodemailer.createTransport({
		SES: {
			ses,
			aws
		}
	});
}

export async function sendMail(options: MailerOptions): Promise<void> {
	if (!disabledFeatures.email) {
		const { to, subject, username, paragraph, preview, text, link, confirmation } = options;

		let html = confirmation ? confirmationEmailTemplate : genericEmailTemplate;

		html = html.replace(/{{username}}/g, username);
		html = html.replace(/{{paragraph}}/g, paragraph || '');
		html = html.replace(/{{preview}}/g, preview || '');
		html = html.replace(/{{confirmation-href}}/g, confirmation?.href || '');
		html = html.replace(/{{confirmation-code}}/g, confirmation?.code || '');

		if (link) {
			const { href, text } = link;

			const button = `<tr><td width="100%" height="16px" style="line-height: 16px;">&nbsp;</td></tr><tr><td class="confirm-link" bgcolor="#673db6" style="font-size: 14px; font-weight: 700; border-radius: 10px; padding: 12px" align="center"><a href="${href}" style="text-decoration: none; color: #ffffff; " width="100%">${text}</a></td></tr>`;
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
