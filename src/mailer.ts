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
	* adds padding of the specified height in px
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
		this.componentArray.push(component, this.addPadding(24));

		return this;
	}

	/**
	* adds a paragraph. for links, do addParagraph("this is a [named link](https://example.org)."). for greetings, do addParagraph("Hi {{pnid}}!", { pnid: "theUsername" })
	*/
	public addParagraph(text: string, replacements?: emailTextReplacements): this {
		const component: emailComponent = { type: 'paragraph', text, replacements };
		this.componentArray.push(component, this.addPadding(16));

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
		this.componentArray.push(this.addPadding(4), component, this.addPadding(32));

		return this;
	}

	// parses pnid name and links. set the plaintext bool (false by default) to use no html
	private parseReplacements(c: emailComponent, plainText: boolean = false): void {
		// for now only replaces the pnid for shoutouts. could easily be expanded to add more.
		if (c?.replacements) {
			Object.entries(c.replacements).forEach(([key, value]) => {
				if (key === 'pnid') {
					if (plainText) {
						c.text = c.text.replace(/{{pnid}}/g, value);
					} else {
						c.text = c.text.replace(/{{pnid}}/g, `<span class="shoutout" style="color: #cab1fb;">${value}</span>`);
					}
				}
			});
		}

		// replace [links](https://example.com) with html anchor tags or a plaintext representation
		const linkRegex = /\[(?<linkText>.*?)\]\((?<linkAddress>.*?)\)/g;

		if (linkRegex.test(c.text)) {
			if (plainText) {
				c.text = c.text.replace(linkRegex, `$<linkText> ($<linkAddress>)`);
			} else {
				c.text = c.text.replace(linkRegex, `<a href="$<linkAddress>" style="text-decoration: none; font-weight: 700; color: #ffffff; ">$<linkText></a>`);
			}
		}
	}

	// generates the html version of the email
	public toHTML(): string {
		let innerHTML = '';

		this.componentArray.forEach((c) => {
			switch (c.type) {
				case 'padding':
					innerHTML += `\n<tr><td width="100%" height="${c.size}px" style="line-height: ${c.size}px;">&nbsp;</td></tr>`;
					break;
				case 'header':
					this.parseReplacements(c);
					innerHTML += `\n<tr style="font-size: 24px; font-weight: 700; color: #fff"><td class="header">${c.text}</td></tr>`;
					break;
				case 'paragraph':
					this.parseReplacements(c);
					innerHTML += `\n<tr><td>${c.text}</td></tr>`;
					break;
				case 'button':
					innerHTML += `\n<tr><td class="${c.primary ? 'primary' : 'secondary'}" bgcolor="#673db6" style="font-weight: 700; border-radius: 10px; padding: 12px" align="center"><a href="${c.link || ''}" style="color: #ffffff; " width="100%">${c.text}</a></td></tr>`;
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
			switch (c.type) {
				case 'padding':
					break;
				case 'header':
					this.parseReplacements(c, true);
					plainText += `\n${c.text}`;
					break;
				case 'paragraph':
					this.parseReplacements(c, true);
					plainText += `\n${c.text}`;
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
