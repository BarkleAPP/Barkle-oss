import * as fs from 'node:fs';
import { createTemp } from '@/misc/create-temp.js';
import FFmpeg from 'fluent-ffmpeg';

export interface IVideo {
	data: fs.ReadStream;
	ext: string;
	type: string;
}

/**
 * Convert video to MP4 format for better browser compatibility
 * @param source Path to source video file
 * @returns Converted video as stream with metadata
 */
export async function convertToMp4(source: string): Promise<IVideo> {
	const [path, cleanup] = await createTemp();

	try {
		await new Promise<void>((resolve, reject) => {
			FFmpeg(source)
				.videoCodec('libx264')
				.audioCodec('aac')
				.outputOptions([
					'-preset', 'fast',
					'-crf', '23',
					'-movflags', '+faststart', // Enable streaming
					'-pix_fmt', 'yuv420p', // Better compatibility
				])
				.output(path)
				.on('end', () => resolve())
				.on('error', (err) => reject(err))
				.run();
		});

		const data = fs.createReadStream(path);
		
		// Clean up temp file when stream is closed
		data.on('close', () => cleanup());
		data.on('error', () => cleanup());

		return {
			data,
			ext: 'mp4',
			type: 'video/mp4',
		};
	} catch (err) {
		cleanup();
		throw err;
	}
}

/**
 * Check if video needs transcoding to MP4
 * @param type MIME type of the video
 * @returns true if transcoding is recommended
 */
export function shouldTranscodeVideo(type: string): boolean {
	// List of video formats that should be transcoded to MP4 for better compatibility
	const transcodableFormats = [
		'video/quicktime', // .mov
		'video/x-msvideo', // .avi
		'video/x-matroska', // .mkv
		'video/x-flv', // .flv
	];

	return transcodableFormats.includes(type);
}
