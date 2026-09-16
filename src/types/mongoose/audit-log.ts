import type { Model, HydratedDocument, Types } from 'mongoose';
import type { AuditLogActionType } from '@pretendonetwork/grpc/account/v2/audit_log_action_type';

export interface IAuditLogComment {
	_id: Types.ObjectId;
	pid: number;
	created: Date;
	content: string;
}

export interface IAuditLog {
	action_type: AuditLogActionType;
	executed_by_pid: number;
	created: Date;
	metadata: string;
	comments: Types.DocumentArray<IAuditLogComment>;
}

export interface IAuditLogMethods {}

interface IAuditLogQueryHelpers {}

export interface AuditLogModel extends Model<IAuditLog, IAuditLogQueryHelpers, IAuditLogMethods> {}

export type HydratedAuditLogDocument = HydratedDocument<IAuditLog, IAuditLogMethods>;
