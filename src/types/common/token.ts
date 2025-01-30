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