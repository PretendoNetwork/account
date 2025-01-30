export const TokenTypes = {
	OAUTH_ACCESS: 1,
	OAUTH_REFRESH: 2,
	NEX: 3,
	SERVICE: 4,
	PASSWORD_RESET: 5
} as const;

export function getTokenTypeFromValue(type: number): keyof typeof TokenTypes | undefined {
	const keys = Object.keys(TokenTypes) as (keyof typeof TokenTypes)[];
	return keys.find((key) => TokenTypes[key] === type);
}

export interface Token {
	system_type: number;
	token_type: keyof typeof TokenTypes;
	pid: number;
	access_level?: number;
	title_id?: bigint;
	expire_time: bigint;
}

// ? Separated so additional non-token fields can be added in the future
export type TokenOptions = Token