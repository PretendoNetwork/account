export const PNID_PERMISSION_FLAGS = {
	BANNED_ALL_PERMANENTLY: 1n << 0n,
	BANNED_ALL_TEMPORARILY: 1n << 1n,
	BETA_ACCESS:            1n << 2n,
	ACCESS_ADMIN_PANEL:     1n << 3n,
	CREATE_SERVER_CONFIGS:  1n << 4n,
	MODIFY_SERVER_CONFIGS:  1n << 5n,
	DEPLOY_SERVER:          1n << 6n,
	MODIFY_PNIDS:           1n << 7n,
	MODIFY_NEX_ACCOUNTS:    1n << 8n,
	MODIFY_CONSOLES:        1n << 9n,
	BAN_PNIDS:              1n << 10n,
	BAN_NEX_ACCOUNTS:       1n << 11n,
	BAN_CONSOLES:           1n << 12n,
	MODERATE_MIIVERSE:      1n << 13n,
	CREATE_API_KEYS:        1n << 14n, // * This applies to all services
} as const;

export type PNIDPermissionFlag = (typeof PNID_PERMISSION_FLAGS)[keyof typeof PNID_PERMISSION_FLAGS];