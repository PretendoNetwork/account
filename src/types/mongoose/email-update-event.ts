import type { Model, HydratedDocument } from 'mongoose';

export interface IEmailUpdateEvent {
	new: string;
	old: string;
	on: Date;
}

export interface IEmailUpdateEventMethods {}

interface IEmailUpdateEventQueryHelpers {}

export interface EmailUpdateEventModel extends Model<IEmailUpdateEvent, IEmailUpdateEventQueryHelpers, IEmailUpdateEventMethods> {}

export type HydratedEmailUpdateDocument = HydratedDocument<IEmailUpdateEvent, IEmailUpdateEventMethods>;
