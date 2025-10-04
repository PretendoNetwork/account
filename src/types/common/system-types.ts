// TODO - Maybe this shouldn't be in the `types` folder, since it's also actual data?
// * WUP and CTR are wrong officially, these are just the IDs we gave.
// * Normally CTR comes before WUP, but we supported WUP before CTR
export enum SystemType {
	WUP = 1,
	CTR = 2,
	API = 3,
	PasswordReset = 0xFF // * This kinda blows
}
