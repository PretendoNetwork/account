import path from 'node:path';
import fs from 'node:fs';
import nodemailer from 'nodemailer';
import * as aws from '@aws-sdk/client-ses';
import { config, disabledFeatures } from '@/config-manager';
import type { MailerOptions } from '@/types/common/mailer-options';

const genericEmailTemplate = fs.readFileSync(path.join(__dirname, './assets/emails/genericTemplate.html'), 'utf8');

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

interface emailComponent {
	type: 'header' | 'paragraph';
	text: string;
	replacements?: emailTextReplacements;
}
interface paddingComponent {
	type: 'padding';
	size: number;
}
interface buttonComponent {
	type: 'button';
	text: string;
	link?: string;
	primary?: boolean;
}
interface emailTextReplacements {
	[key: string]: string;
}

export class CreateEmail {
	// an array which stores all components of the email
	private readonly componentArray: (emailComponent | paddingComponent | buttonComponent)[] = [];

	/**
	* adds padding of the specified height in em units
	*/
	private addPadding(size: number): paddingComponent {
		return {
			type: 'padding',
			size
		};
	}

	/**
	* adds a header. for greetings, do addHeader("Hi {{pnid}}!", { pnid: "theUsername" })
	*/
	public addHeader(text: string, replacements?: emailTextReplacements): this {
		const component: emailComponent = { type: 'header', text, replacements };
		this.componentArray.push(this.addPadding(3), component, this.addPadding(2));

		return this;
	}

	/**
	* adds a paragraph. for links, do addParagraph("this is a [named link](https://example.org)."). for greetings, do addParagraph("Hi {{pnid}}!", { pnid: "theUsername" })
	*/
	public addParagraph(text: string, replacements?: emailTextReplacements): this {
		const component: emailComponent = { type: 'paragraph', text, replacements };
		this.componentArray.push(component, this.addPadding(1));

		return this;
	}

	/**
	* adds a button
	*
	* @param {String} text the button text
	* @param {String} [link] the link
	* @param {boolean} [primary] set to false to use the secondary button styles (true by default)
	*/
	public addButton(text: string, link?: string, primary: boolean = true): this {
		const component: buttonComponent = { type: 'button', text, link, primary };
		this.componentArray.push(component, this.addPadding(2));

		return this;
	}

	private addGmailDarkModeFix(el: string): string {
		return `<div class="gmail-s"><div class="gmail-d">${el}</div></div>`;
	}

	// parses pnid name and links. set the plaintext bool (false by default) to use no html
	private parseReplacements(c: emailComponent, plainText: boolean = false): string {
		let tempText = c.text;

		// for now only replaces the pnid for shoutouts. could easily be expanded to add more.
		if (c?.replacements) {
			Object.entries(c.replacements).forEach(([key, value]) => {
				if (key === 'pnid') {
					if (plainText) {
						tempText = tempText.replace(/{{pnid}}/g, value);
					} else {
						tempText = tempText.replace(/{{pnid}}/g, `<span class="shoutout" style="color:#cab1fb;">${value}</span>`);
					}
				}
			});
		}

		// wrap <b> and <strong> in a <span> element, to fix color on thunderbird and weight on icloud mail web
		const bRegex = /<b ?>.*?<\/b>|<strong ?>.*?<\/strong>/g;

		if (!plainText) {
			tempText = tempText.replace(bRegex, el => `<span style="color:#fff;font-weight:bold;">${el}</span>`);
		}

		// replace [links](https://example.com) with html anchor tags or a plaintext representation
		const linkRegex = /\[(?<linkText>.*?)\]\((?<linkAddress>.*?)\)/g;

		if (plainText) {
			tempText = tempText.replace(linkRegex, '$<linkText> ($<linkAddress>)');
		} else {
			tempText = tempText.replace(linkRegex, '<a href="$<linkAddress>" style="text-decoration:underline;font-weight:700;color:#fff;"><u>$<linkText></u></a>');
		}

		return tempText;
	}

	// generates the html version of the email
	public toHTML(): string {
		let innerHTML = '';

		this.componentArray.map((c, i) => {
			let el = '';

			/* double padding causes issues, and the signature already has padding, so if the last element
			*  is padding we just yeet it
			*/
			if (i === this.componentArray.length - 1 && c.type === 'padding') {
				return;
			}

			switch (c.type) {
				case 'padding':
					innerHTML += `\n<tr><td width="100%" style="line-height:${c.size}em;">&nbsp;</td></tr>`;
					break;
				case 'header':
					el = this.parseReplacements(c);
					innerHTML += `\n<tr style="font-size:24px;font-weight:700;color:#fff"><td class="header">${this.addGmailDarkModeFix(el)}</td></tr>`;
					break;
				case 'paragraph':
					el = this.parseReplacements(c);
					innerHTML += `\n<tr><td>${this.addGmailDarkModeFix(el)}</td></tr>`;
					break;
				case 'button':
					if (c.link) {
						el = `<a href="${c.link}" style="color:#fff;" width="100%">${el}</a>`;
					} else {
						el = `<span style="color:#fff;" width="100%">${el}</span>`;
					}
					innerHTML += `\n<tr><td ${c.primary ? 'class="primary button" bgcolor="#673db6"' : 'class="secondary button" bgcolor="#373C65"'} style="font-weight:700;border-radius:10px;padding:12px" align="center">${this.addGmailDarkModeFix(el)}</td></tr>`;
					break;
			}
		});

		const generatedHTML = genericEmailTemplate.replace('<!--innerHTML-->', innerHTML);

		return generatedHTML;
	}

	// generates the plaintext version that shows up on the email preview (and is shown by plaintext clients)
	public toPlainText(): string {
		let plainText = '';

		this.componentArray.forEach((c) => {
			let el = '';
			switch (c.type) {
				case 'padding':
					break;
				case 'header':
					el = this.parseReplacements(c, true);
					plainText += `\n${el}`;
					break;
				case 'paragraph':
					el = this.parseReplacements(c, true);
					plainText += `\n${el}`;
					break;
				case 'button':
					if (c.link) {
						plainText += `\n\n${c.text}: ${c.link}\n`;
					} else {
						plainText += ` ${c.text}\n`;
					}
					break;
			}
		});

		// the signature is baked into the template, so it needs to be added manually to the plaintext version
		plainText += '\n\n- The Pretendo Network team';

		// and so is the notice about the email being auto-generated
		plainText += '\n\nNote: This is an automatic email; please do not respond. For assistance, please visit https://forum.pretendo.network.';

		plainText = plainText.replace(/(<([^>]+)>)/gi, '');

		return plainText;
	}
}

export async function sendMail(options: MailerOptions): Promise<void> {
	if (!disabledFeatures.email) {
		const { to, subject, email } = options;

		await transporter.sendMail({
			from: config.email.from,
			to,
			subject,
			text: email.toPlainText(),
			html: email.toHTML()
		});
	}
}
