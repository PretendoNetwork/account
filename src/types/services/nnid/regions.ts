export interface Regions {
	id: number;
	iso_code: string;
	name: string;
	translations: Translations;
	regions?: (RegionsEntity)[] | null;
}

export interface Translations {
	japanese: string;
	english: string;
	french: string;
	german: string;
	italian: string;
	spanish: string;
	chinese_simple: string;
	korean: string;
	dutch: string;
	portuguese: string;
	russian: string;
	chinese_traditional: string;
	unknown1: string;
	unknown2: string;
	unknown3: string;
	unknown4: string;
}

export interface RegionsEntity {
	id: number;
	name: string;
	translations: Translations;
	coordinates: Coordinates;
}

export interface Coordinates {
	latitude: number;
	longitude: number;
}
