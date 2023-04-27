declare module 'tga' {
	export interface TGAHeader {
		idLength: number;
		colorMapType: number;
		dataType: number;
		colorMapOrigin: number;
		colorMapLength: number;
		colorMapDepth: number;
		xOrigin: number;
		yOrigin: number;
		width: number;
		height: number;
		bitsPerPixel: number;
		flags: number;
		id: string;
	}

	export default class TGA {
		constructor(buf: Buffer, opt?: { dontFixAlpha: boolean });

		static createTgaBuffer(width: number, height: number, pixels: Uint8Array, dontFlipY: boolean): Buffer;

		parseHeader(): void;
		parseFooter(): void;
		parseExtension(extensionAreaOffset: number): void;
		readColor(offset: number, bytesPerPixel: number): Uint8Array;
		readColorWithColorMap(offset: number): Uint8Array;
		readColorAuto(offset: number, bytesPerPixel: number, isUsingColorMap: boolean): Uint8Array;
		parseColorMap(): void;
		setPixel(pixels: Uint8Array, idx: number, color: Uint8Array): void;
		parsePixels(): void;
		parse(): void;
		fixForAlpha(): void;

		public dontFixAlpha: boolean;
		public _buff: Buffer;
		public data: Uint8Array;
		public currentOffset: number;

		public header: TGAHeader;

		public width: number;
		public height: number;

		public isUsingColorMap: boolean;
		public isUsingRLE: boolean;
		public isGray: boolean;

		public hasAlpha: boolean;

		public isFlipX: boolean;
		public isFlipY: boolean;

		public colorMap: Uint8Array;

		public pixels: Uint8Array;
	}
}