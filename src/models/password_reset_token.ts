import { Schema, model } from 'mongoose';
import type { Model, HydratedDocument } from 'mongoose';

// TODO - Move these to the types folder, just putting them here to push this out the door
export interface IPasswordResetToken {
	token: string;
	pid: number;
	info: {
		system_type: number;
		token_type: number;
		title_id: bigint;
		issued: Date;
		expires: Date;
	};
}

export interface IPasswordResetTokenMethods {}

interface IPasswordResetTokenQueryHelpers {}

export interface PasswordResetTokenModel extends Model<IPasswordResetToken, IPasswordResetTokenQueryHelpers, IPasswordResetTokenMethods> {}

export type HydratedPasswordResetTokenDocument = HydratedDocument<IPasswordResetToken, IPasswordResetTokenMethods>;

const PasswordResetTokenSchema = new Schema<IPasswordResetToken, PasswordResetTokenModel, IPasswordResetTokenMethods>({
	token: String,
	pid: Number,
	info: {
		system_type: Number,
		token_type: Number,
		title_id: BigInt,
		issued: Date,
		expires: Date
	}
});

PasswordResetTokenSchema.index({ 'info.expires': 1 }, { expireAfterSeconds: 0 });

export const PasswordResetToken = model<IPasswordResetToken, PasswordResetTokenModel>('PasswordResetToken', PasswordResetTokenSchema);
