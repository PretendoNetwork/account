export const TokenType = {
	OAUTH_ACCESS: 1,
	OAUTH_REFRESH: 2,
	NEX: 3,
	SERVICE: 4,
	PASSWORD_RESET: 5
} as const;
export type TokenType = typeof TokenType[keyof typeof TokenType];

export const SystemType = {
	'WIIU': 1,
	'3DS': 2,
	'API': 3
} as const;
export type SystemType = typeof SystemType[keyof typeof SystemType];

export interface Token {
	system_type: SystemType;
	token_type: TokenType;
	pid: number;
	access_level?: number;
	title_id?: bigint;
	expire_time: bigint;
}

// ? Separated so additional non-token fields can be added in the future
export type TokenOptions = Token

export type OAuthTokenGenerationResponse = {
	accessToken: string;
	refreshToken: string;
	expiresInSecs: {
		access: number;
		refresh: number;
	}
};

export type OAuthTokenOptions = {
	/** 
	 * The number of seconds the access token will be valid for, defaults to 1 hour
	 * @default 60 * 60
	 */ 
	accessExpiresIn?: number;
	/** 
	 * The number of seconds the refresh token will be valid for, defaults to 14 days
	 * @default 14 * 24 * 60 * 60
	 */
	refreshExpiresIn?: number;
}