import { Schema, model } from 'mongoose';
import type { Model, HydratedDocument } from 'mongoose';

// TODO - Move these to the types folder, just putting them here to push this out the door
export interface IOAuthToken {
	token: string;
	client_id: string;
	client_secret: string;
	pid: number;
	info: {
		system_type: number;
		token_type: number;
		title_id: bigint;
		issued: Date;
		expires: Date;
	};
}

export interface IOAuthTokenMethods {}

interface IOAuthTokenQueryHelpers {}

export interface OAuthTokenModel extends Model<IOAuthToken, IOAuthTokenQueryHelpers, IOAuthTokenMethods> {}

export type HydratedOAuthTokenDocument = HydratedDocument<IOAuthToken, IOAuthTokenMethods>;

const OAuthTokenSchema = new Schema<IOAuthToken, OAuthTokenModel, IOAuthTokenMethods>({
	token: String,
	client_id: String,
	client_secret: String,
	pid: Number,
	info: {
		system_type: Number,
		token_type: Number,
		title_id: BigInt,
		issued: Date,
		expires: Date
	}
});

export const OAuthToken = model<IOAuthToken, OAuthTokenModel>('OAuthToken', OAuthTokenSchema);
