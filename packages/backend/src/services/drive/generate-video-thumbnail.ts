import * as fs from 'node:fs';
import { createTempDir } from '@/misc/create-temp.js';
import { IImage, convertToJpeg } from './image-processor.js';
import FFmpeg from 'fluent-ffmpeg';
import { findFFmpeg } from '@/misc/ffmpeg-path.js';

// Try to set FFmpeg path, but don't fail if it's not available
try {
	const ffmpegPath = findFFmpeg();
	if (ffmpegPath && !ffmpegPath.includes('not-found')) {
		FFmpeg.setFfmpegPath(ffmpegPath);
	}
} catch (error) {
	console.warn('FFmpeg initialization failed:', error instanceof Error ? error.message : String(error));
}

export async function GenerateVideoThumbnail(source: string): Promise<IImage> {
	// Check if FFmpeg is actually available
	let ffmpegAvailable = false;
	try {
		const ffmpegPath = findFFmpeg();
		ffmpegAvailable = ffmpegPath && typeof ffmpegPath === 'string' && !ffmpegPath.includes('not-found') && fs.existsSync(ffmpegPath);
	} catch (error) {
		console.warn('FFmpeg availability check failed:', error instanceof Error ? error.message : String(error));
	}

	if (!ffmpegAvailable) {
		throw new Error('Video thumbnail generation is not available: FFmpeg is not installed or accessible');
	}

	const [dir, cleanup] = await createTempDir();

	try {
		await new Promise((res, rej) => {
			FFmpeg(source)
				.on('end', res)
				.on('error', rej)
				.screenshot({
					folder: dir,
					filename: 'out.png',	// must have .png extension
					count: 1,
					timestamps: ['5%'],
				})
				.run();
		});

		// JPEGに変換 (Webpでもいいが、MastodonはWebpをサポートせず表示できなくなる)
		return await convertToJpeg(`${dir}/out.png`, 498, 280);
	} finally {
		cleanup();
	}
}
