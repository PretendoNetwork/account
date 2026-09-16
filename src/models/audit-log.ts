import { Schema, model } from 'mongoose';
import { AuditLogActionType } from '@pretendonetwork/grpc/account/v2/audit_log_action_type';
import type { IAuditLog, IAuditLogComment, IAuditLogMethods, AuditLogModel } from '@/types/mongoose/audit-log';

const AuditLogCommentSchema = new Schema<IAuditLogComment>({
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

const AuditLogSchema = new Schema<IAuditLog, AuditLogModel, IAuditLogMethods>({
	action_type: {
		type: Number,
		enum: Object.values(AuditLogActionType).filter(value => typeof value === 'number'),
		required: true,
		index: true
	},
	executed_by_pid: {
		type: Number,
		required: true,
		index: true
	},
	created: {
		type: Date,
		default: Date.now,
		index: true
	},
	metadata: { // * This is just arbitrary metadata about the log, which may be context-specific, for example holding the before and after of a user data change
		type: String,
		default: '{}',
		validate: {
			validator: (value: string): boolean => {
				try {
					JSON.parse(value);
					return true;
				} catch {
					return false;
				}
			},
			message: 'metadata must be a valid JSON string'
		}
	},
	comments: {
		type: [AuditLogCommentSchema],
		default: []
	}
});

export const AuditLog = model<IAuditLog, AuditLogModel>('AuditLog', AuditLogSchema);
