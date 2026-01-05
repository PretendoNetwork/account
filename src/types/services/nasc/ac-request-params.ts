/**
 * Çommon request parameters found on all NASC `ac` requests.
 * All fields are base64 encoded using Nintendo's custom alphabet:
 * '+' -> '.', '/' -> '-', '=' -> '*'
 */
export interface NASCCommonACRequestParams {
	/**
	 * Game server ID (`%08X`). This is the same as the `X-GameId` header.
	 * Derived from the games default title ID (usually the Japanese title ID)
	 */
	gameid: string;

	/**
	 * Major and minor SDK version (`%03d%03d`). Always `000000`
	 */
	sdkver: string;

	/**
	 * Title ID (`%016X`)
	 */
	titleid: string;

	/**
	 * Product code. See https://3dsdb.com/
	 */
	gamecd: string;

	/**
	 * Title version (`%04X`)
	 */
	gamever: string;

	/**
	 * Game type
	 *
	 * - 0 = System
	 * - 1 = Digital
	 * - 2 = Cartridge
	 */
	mediatype: string;

	/**
	 * Unique ROM (game) ID.
	 * Only present if the media type is 2 (cartridge)
	 */
	romid?: string;

	/**
	 * Product maker (company code)
	 */
	makercd: string;

	/**
	 * Unit code
	 *
	 * - 0 = NDS
	 * - 1 = Wii
	 * - 2 = 3DS
	 */
	unitcd: string;

	/**
	 * Device MAC address
	 */
	macadr: string;

	/**
	 * BSSID of active wifi network
	 */
	bssid: string;

	/**
	 * Information about the used Wi-Fi access point in the format `AA:BBBBBBBBBB`.
	 * Example `01:0000000000`. `AA` is the AP slot. `BBBBBBBBBB` comes from either `ACU_GetNZoneApNumService` or `ACU_GetConnectingHotspotSubset` based on the result from `ACU_GetWifiStatus`
	 */
	apinfo: string;

	/**
	 * LocalFriendCodeSeed_B
	 */
	fcdcert: string;

	/**
	 * Device name (UTF-16-LE)
	 */
	devname: string;

	/**
	 * Environment (`L1` for production)
	 */
	servertype: string;

	/**
	 * FPD version (`%04X`). This is also included in the user agent.
	 */
	fpdver: string;

	/**
	 * Current device time (`%y%m%d%H%M%S`)
	 */
	devtime: string;

	/**
	 * Language code (`%02X`)
	 */
	lang: string;

	/**
	 * Region code (`%02X`)
	 */
	region: string;

	/**
	 * Serial number
	 */
	csnum: string;

	/**
	 * The type of action the console wishes to perform:
	 *
	 * - LOGIN = Register new game server account or login to existing on
	 * - SVCLOC = Request service token
	 * - nzchk = Unknown, but seems related to Nintendo Zone
	 * - parse = Unknown
	 * - message = Unknown
	 */
	action: string;
}

/**
 * Request parameters for when a console wants to register a new game server account.
 * See also NASCCommonRequestParams.
 * All fields are base64 encoded using Nintendo's custom alphabet:
 * '+' -> '.', '/' -> '-', '=' -> '*'
 */
export interface NASCRegistrationACRequestParams extends NASCCommonACRequestParams {
	/**
	 * Game server account password the console wishes to use for the new account.
	 * Can be any character between `\x21-\x5B` and `\x5D-\x7D`. Always 16 characters long
	 */
	passwd: string;

	/**
	 * Nickname provided by game.
	 * Usually unused, leftover from the Wii
	 */
	ingamesn: string;
}

/**
 * Request parameters for when a console wants to login to an existing game server account.
 * See also NASCCommonRequestParams.
 * All fields are base64 encoded using Nintendo's custom alphabet:
 * '+' -> '.', '/' -> '-', '=' -> '*'
 */
export interface NASCLoginACRequestParams extends NASCCommonACRequestParams {
	/**
	 * Hash of the user ID
	 */
	uidhmac: string;

	/**
	 * Game server account user ID/username.
	 * Always the NEX account PID on 3DS
	 */
	userid: string;

	/**
	 * Nickname provided by game.
	 * Usually unused, leftover from the Wii
	 */
	ingamesn: string;
}

/**
 * Request parameters for when a console wants to request a service token.
 * See also NASCCommonRequestParams.
 * All fields are base64 encoded using Nintendo's custom alphabet:
 * '+' -> '.', '/' -> '-', '=' -> '*'
 */
export interface NASCServiceTokenACRequestParams extends NASCCommonACRequestParams {
	/**
	 * Hash of the user ID
	 */
	uidhmac: string;

	/**
	 * Game server account user ID/username.
	 * Always the NEX account PID on 3DS
	 */
	userid: string;

	/**
	 * Unique hash assigned to each game, regardless of title ID.
	 * Analogous to the NNAS client ID
	 */
	keyhash: string;

	/**
	 * Service request type. Changes the `svchost` response field.
	 * This is likely a remnant from the original NAS/NASWII servers.
	 *
	 * - 0000 = "n/a"
	 * - 9001 = "dls1.nintendowifi.net"
	 */
	svc: string;
}

/**
 * Union type representing all possible NASC request parameter types.
 * The specific type used depends on the `action` field value:
 *
 * - `action: 'LOGIN'` = `NASCRegistrationRequestParams` or `NASCLoginRequestParams`
 * - `action: 'SVCLOC'` = `NASCServiceTokenRequestParams`
 */
export type NASCACRequestParams = NASCRegistrationACRequestParams | NASCLoginACRequestParams | NASCServiceTokenACRequestParams;
