import * as fs from 'node:fs';
import { createTempDir } from '@/misc/create-temp.js';
import { IImage, convertToJpeg } from './image-processor.js';
import FFmpeg from 'fluent-ffmpeg';
import { findFFmpeg, findFFprobe } from '@/misc/ffmpeg-path.js';
import Logger from '@/services/logger.js';
import { execSync } from 'node:child_process';

const logger = new Logger('generate-video-thumbnail');

// Try to set FFmpeg and FFprobe paths, but don't fail if not available
try {
	const ffmpegPath = findFFmpeg();
	if (ffmpegPath && !ffmpegPath.includes('not-found')) {
		FFmpeg.setFfmpegPath(ffmpegPath);
		logger.info(`FFmpeg path set to: ${ffmpegPath}`);
	}
	const ffprobePath = findFFprobe();
	if (ffprobePath && !ffprobePath.includes('not-found')) {
		FFmpeg.setFfprobePath(ffprobePath);
		logger.info(`FFprobe path set to: ${ffprobePath}`);
	}
} catch (error) {
	logger.error('FFmpeg initialization failed:', { error: error instanceof Error ? error.message : String(error) });
}

export async function GenerateVideoThumbnail(source: string): Promise<IImage> {
	const ffmpegPath = findFFmpeg();
	const ffprobePath = findFFprobe();

	logger.info(`Generating video thumbnail for: ${source}`);
	logger.info(`FFmpeg path: ${ffmpegPath}, FFprobe path: ${ffprobePath}`);

	// Check if FFmpeg is actually available
	let ffmpegAvailable = false;
	try {
		ffmpegAvailable = !!(ffmpegPath && typeof ffmpegPath === 'string' && !ffmpegPath.includes('not-found') && fs.existsSync(ffmpegPath));

		if (ffmpegAvailable) {
			// Test FFmpeg execution
			try {
				const version = execSync(`${ffmpegPath} -version 2>&1 | head -1`, { encoding: 'utf-8', timeout: 5000 });
				logger.info(`FFmpeg version check: ${version.trim()}`);
			} catch (execError) {
				logger.error('FFmpeg execution test failed:', { error: execError instanceof Error ? execError.message : String(execError) });
				ffmpegAvailable = false;
			}
		}
	} catch (error) {
		logger.error('FFmpeg availability check failed:', { error: error instanceof Error ? error.message : String(error) });
	}

	if (!ffmpegAvailable) {
		const errorMsg = `Video thumbnail generation is not available: FFmpeg path=${ffmpegPath}, exists=${ffmpegPath ? fs.existsSync(ffmpegPath) : false}`;
		logger.error(errorMsg);
		throw new Error(errorMsg);
	}

	const [dir, cleanup] = await createTempDir();

	try {
		await new Promise<void>((res, rej) => {
			FFmpeg(source)
				.on('start', (cmd) => {
					logger.info(`FFmpeg command: ${cmd}`);
				})
				.on('end', () => {
					logger.info('FFmpeg screenshot completed successfully');
					res();
				})
				.on('error', (err, stdout, stderr) => {
					logger.error('FFmpeg error:', {
						error: err.message,
						stdout: stdout || 'none',
						stderr: stderr || 'none',
						source,
						ffmpegPath,
					});
					rej(new Error(`FFmpeg failed: ${err.message}. Stderr: ${stderr || 'none'}`));
				})
				.screenshot({
					folder: dir,
					filename: 'out.png',
					count: 1,
					timestamps: ['5%'],
				});
		});

		// Check if output file exists
		const outputPath = `${dir}/out.png`;
		if (!fs.existsSync(outputPath)) {
			throw new Error(`FFmpeg did not create output file at ${outputPath}`);
		}

		logger.info('Converting screenshot to JPEG...');
		// Convert to JPEG (WebP would be better but Mastodon doesn't support WebP display)
		return await convertToJpeg(outputPath, 498, 280);
	} catch (error) {
		logger.error('Video thumbnail generation failed:', {
			error: error instanceof Error ? error.message : String(error),
			source,
			dir,
		});
		throw error;
	} finally {
		cleanup();
	}
}
