import { Schema, model } from 'mongoose';
import { BanTargetType, BanScopeType } from '@pretendonetwork/grpc/account/v2/ban_details';
import type { IBan, IBanComment, IBanMethods, BanModel } from '@/types/mongoose/ban';

// * Taking a note from NEX with this
export const PERMANENT_BAN_END_DATE = new Date('9999-12-31T23:59:59.999Z');

const BanCommentSchema = new Schema<IBanComment>({
	pid: {
		type: Number,
		required: true
	},
	created: {
		type: Date,
		default: Date.now
	},
	content: {
		type: String,
		required: true
	}
});

const BanSchema = new Schema<IBan, BanModel, IBanMethods>({
	target_type: {
		type: Number,
		enum: Object.values(BanTargetType).filter(value => typeof value === 'number'),
		required: true
	},
	target: { // * Set as a string to not limit this to PIDs
		type: String,
		required: true
	},
	issuer: { // * Set as a string to not limit this to PIDs
		type: String,
		required: true,
		index: true
	},
	start_date: {
		type: Date,
		required: true
	},
	end_date: {
		type: Date,
		required: true,
		index: true
	},
	scope_type: {
		type: Number,
		enum: Object.values(BanScopeType).filter(value => typeof value === 'number'),
		required: true
	},
	scope_target: { // * Empty when the scope is BAN_SCOPE_TYPE_ALL
		type: String,
		default: ''
	},
	reason: {
		type: String,
		required: true
	},
	issued_date: {
		type: Date,
		default: Date.now,
		index: true
	},
	updated_date: {
		type: Date,
		default: Date.now
	},
	pardoned_date: Date,
	pardoned_reason: String,
	comments: {
		type: [BanCommentSchema],
		default: []
	}
});

BanSchema.index({
	target_type: 1,
	target: 1
});

export const Ban = model<IBan, BanModel>('Ban', BanSchema);
