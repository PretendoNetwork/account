export const TokenTypes = {
	OAUTH_ACCESS: 1,
	OAUTH_REFRESH: 2,
	NEX: 3,
	SERVICE: 4,
	PASSWORD_RESET: 5
} as const;
export type TokenType = keyof typeof TokenTypes;

export function getTokenTypeFromValue(type: number): TokenType | undefined {
	const keys = Object.keys(TokenTypes) as TokenType[];
	return keys.find((key) => TokenTypes[key] === type);
}

export const SystemTypes = {
	'WIIU': 1,
	'3DS': 2,
	'API': 3
} as const;
export type SystemType = keyof typeof SystemTypes;

export const serverDeviceToSystemType: Record<number, SystemType> = {
	1: 'WIIU',
	2: '3DS'
};

export function getSystemTypeFromValue(type: number): SystemType | undefined {
	const keys = Object.keys(SystemTypes) as SystemType[];
	return keys.find((key) => SystemTypes[key] === type);
}

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