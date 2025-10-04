import type { SystemType } from '@/types/common/system-types';
import type { TokenType } from '@/types/common/token-types';

export interface Token {
	system_type: SystemType;
	token_type: TokenType;
	pid: number;
	access_level?: number;
	title_id?: bigint;
	expire_time: bigint;
}
