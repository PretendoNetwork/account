export interface TokenOptions {
	system_type: number;
	token_type: number;
	pid: number;
	access_level?: number;
	title_id?: bigint;
	expire_time: bigint;
}
