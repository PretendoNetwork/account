import { Schema, model } from 'mongoose';
import type { IEmailUpdateEvent, EmailUpdateEventModel, IEmailUpdateEventMethods } from '@/types/mongoose/email-update-event';

export const EmailUpdateEventSchema = new Schema<IEmailUpdateEvent, EmailUpdateEventModel, IEmailUpdateEventMethods>({
	old: String,
	new: String,
	on: Date
});

export const EmailUpdateEvent = model<IEmailUpdateEvent, EmailUpdateEventModel>('EmailUpdateEvent', EmailUpdateEventSchema);
