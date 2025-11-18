import type { CreateEmail } from '@/mailer';

export interface MailerOptions {
	to: string;
	subject: string;
	email: CreateEmail;
}
