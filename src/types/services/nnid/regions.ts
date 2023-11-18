export interface Country {
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

export interface Region {
	id: number;
	name: string;
	translations: Translations;
	coordinates: {
		latitude: number;
		longitude: number;
	};
}
