import { Schema, model } from 'mongoose';
import type { Model, HydratedDocument } from 'mongoose';

// TODO - Move these to the types folder, just putting them here to push this out the door
export interface IIndependentServiceToken {
	token: string;
	client_id: string;
	title_id: string;
	pid: number;
	info: {
		system_type: number;
		token_type: number;
		title_id: bigint;
		issued: Date;
		expires: Date;
	};
}

export interface IIndependentServiceTokenMethods {}

interface IIndependentServiceTokenQueryHelpers {}

export interface IndependentServiceTokenModel extends Model<IIndependentServiceToken, IIndependentServiceTokenQueryHelpers, IIndependentServiceTokenMethods> {}

export type HydratedIndependentServiceTokenDocument = HydratedDocument<IIndependentServiceToken, IIndependentServiceTokenMethods>;

const IndependentServiceTokenSchema = new Schema<IIndependentServiceToken, IndependentServiceTokenModel, IIndependentServiceTokenMethods>({
	token: String,
	client_id: String,
	title_id: String,
	pid: Number,
	info: {
		system_type: Number,
		token_type: Number,
		title_id: BigInt,
		issued: Date,
		expires: Date
	}
});

IndependentServiceTokenSchema.index({ 'info.expires': 1 }, { expireAfterSeconds: 0 });

export const IndependentServiceToken = model<IIndependentServiceToken, IndependentServiceTokenModel>('IndependentServiceToken', IndependentServiceTokenSchema);
