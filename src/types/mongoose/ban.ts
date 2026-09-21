import type { Model, HydratedDocument, Types } from 'mongoose';
import type { BanTargetType, BanScopeType } from '@pretendonetwork/grpc/account/v2/ban_details';

export interface IBanComment {
	_id: Types.ObjectId;
	pid: number;
	created: Date;
	content: string;
}

export interface IBan {
	target_type: BanTargetType;
	target: string;
	issuer: string;
	start_date: Date;
	end_date: Date;
	scope_type: BanScopeType;
	scope_target: string;
	reason: string;
	issued_date: Date;
	updated_date: Date;
	pardoned_date?: Date;
	pardoned_reason?: string;
	comments: Types.DocumentArray<IBanComment>;
}

export interface IBanMethods {}

interface IBanQueryHelpers {}

export interface BanModel extends Model<IBan, IBanQueryHelpers, IBanMethods> {}

export type HydratedBanDocument = HydratedDocument<IBan, IBanMethods>;
