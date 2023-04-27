export interface MailerOptions {
	to: string;
	subject: string;
	username: string;
	paragraph?: string;
	preview?: string;
	text: string;
	link?: {
		href: string;
		text: string;
	};
	confirmation?: {
		href: string;
		code: string;
	};
}