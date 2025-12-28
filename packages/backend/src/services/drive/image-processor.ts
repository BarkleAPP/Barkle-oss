import sharp from 'sharp';

export type IImage = {
	data: Buffer;
	ext: string | null;
	type: string;
};

/**
 * Convert to JPEG
 *   with resize, remove metadata, resolve orientation, stop animation
 */
export async function convertToJpeg(path: string, width: number, height: number): Promise<IImage> {
	return convertSharpToJpeg(await sharp(path), width, height);
}

export async function convertSharpToJpeg(sharp: sharp.Sharp, width: number, height: number): Promise<IImage> {
	const data = await sharp
		.resize(width, height, {
			fit: 'inside',
			withoutEnlargement: true,
		})
		.rotate()
		.jpeg({
			quality: 82,
			progressive: true,
		})
		.toBuffer();

	return {
		data,
		ext: 'jpg',
		type: 'image/jpeg',
	};
}

/**
 * Convert to WebP
 *   with resize, remove metadata, resolve orientation, stop animation
 */
export async function convertToWebp(path: string, width: number, height: number, quality: number = 82): Promise<IImage> {
	return convertSharpToWebp(await sharp(path), width, height, quality);
}

export async function convertSharpToWebp(sharp: sharp.Sharp, width: number, height: number, quality: number = 82): Promise<IImage> {
	const data = await sharp
		.resize(width, height, {
			fit: 'inside',
			withoutEnlargement: true,
		})
		.rotate()
		.webp({
			quality,
		})
		.toBuffer();

	return {
		data,
		ext: 'webp',
		type: 'image/webp',
	};
}

/**
 * Convert to PNG
 *   with resize, remove metadata, resolve orientation, stop animation
 */
export async function convertToPng(path: string, width: number, height: number): Promise<IImage> {
	return convertSharpToPng(await sharp(path), width, height);
}

export async function convertSharpToPng(sharp: sharp.Sharp, width: number, height: number): Promise<IImage> {
	const data = await sharp
		.resize(width, height, {
			fit: 'inside',
			withoutEnlargement: true,
		})
		.rotate()
		.png()
		.toBuffer();

	return {
		data,
		ext: 'png',
		type: 'image/png',
	};
}

/**
 * Convert to AVIF
 *   with resize, remove metadata, resolve orientation, stop animation
 */
export async function convertToAvif(path: string, width: number, height: number, quality: number = 80): Promise<IImage> {
	return convertSharpToAvif(await sharp(path), width, height, quality);
}

export async function convertSharpToAvif(sharp: sharp.Sharp, width: number, height: number, quality: number = 80): Promise<IImage> {
	const data = await sharp
		.resize(width, height, {
			fit: 'inside',
			withoutEnlargement: true,
		})
		.rotate()
		.avif({
			quality,
		})
		.toBuffer();

	return {
		data,
		ext: 'avif',
		type: 'image/avif',
	};
}
