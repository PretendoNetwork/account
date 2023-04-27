declare module 'image-pixels' {
	import { NdArray } from 'ndarray';

	export interface ImagePixelsOptions {
		source: ImageSource;
		shape: [number, number];
		width: number;
		height: number;
		type: string;
		mime: string;
		clip: [number, number, number, number] | {
			x?: number;
			y?: number;
			width?: number;
			height?: number;
		};
		cache: boolean;
	}

	export type ImageSource = string |
		HTMLImageElement | SVGImageElement | HTMLVideoElement |
		typeof Image | ImageData | ImageBitmap |
		File | Blob |
		Buffer | ArrayBuffer | Uint8Array | Uint8ClampedArray |
		Float32Array | Float64Array | Array<number> | Array<Array<number>> |
		NdArray |
		ImagePixelsOptions;

	export default function pixels(
		src: ImageSource | Promise<ImageSource>
	): ImageData;
}