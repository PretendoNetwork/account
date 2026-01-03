import { Schema, model } from 'mongoose';
import type { Model, HydratedDocument } from 'mongoose';

// TODO - Move these to the types folder, just putting them here to push this out the door
export interface INEXToken {
	token: string;
	game_server_id: string;
	pid: number;
	info: {
		system_type: number;
		token_type: number;
		title_id: bigint;
		issued: Date;
		expires: Date;
	};
}

export interface INEXTokenMethods {}

interface INEXTokenQueryHelpers {}

export interface NEXTokenModel extends Model<INEXToken, INEXTokenQueryHelpers, INEXTokenMethods> {}

export type HydratedNEXTokenDocument = HydratedDocument<INEXToken, INEXTokenMethods>;

const NEXTokenSchema = new Schema<INEXToken, NEXTokenModel, INEXTokenMethods>({
	token: String,
	game_server_id: String,
	pid: Number,
	info: {
		system_type: Number,
		token_type: Number,
		title_id: BigInt,
		issued: Date,
		expires: Date
	}
});

export const NEXToken = model<INEXToken, NEXTokenModel>('NEXToken', NEXTokenSchema);
