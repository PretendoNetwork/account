export interface NASCRequestParams {
	action: string;
	fcdcert: string;
	csnum: string;
	macadr: string;
	titleid: string;
	servertype: string;
	gameid: string;
	userid?: string;
	uidhmac?: string;
	passwd?: string;
}
