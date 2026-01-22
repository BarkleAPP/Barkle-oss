import Bull from 'bull';
import * as fs from 'node:fs';
import * as path from 'node:path';
import unzipper from 'unzipper';

import { queueLogger } from '../../logger.js';
import { createTempDir } from '@/misc/create-temp.js';
import { downloadUrl } from '@/misc/download-url.js';
import { DriveFiles, Emojis } from '@/models/index.js';
import { DbUserImportJobData } from '@/queue/types.js';
import { addFile } from '@/services/drive/add-file.js';
import { genId } from '@/misc/gen-id.js';
import { db } from '@/db/postgre.js';
import { sanitizeObject } from '@/misc/security/input-sanitization.js';

const logger = queueLogger.createSubLogger('import-custom-emojis');

// TODO: 名前衝突時の動作を選べるようにする
export async function importCustomEmojis(job: Bull.Job<DbUserImportJobData>, done: any): Promise<void> {
	logger.info(`Importing custom emojis ...`);

	const file = await DriveFiles.findOneBy({
		id: job.data.fileId,
	});
	if (file == null) {
		done();
		return;
	}

	const [path, cleanup] = await createTempDir();

	logger.info(`Temp dir is ${path}`);

	const destPath = path + '/emojis.zip';

	try {
		fs.writeFileSync(destPath, '', 'binary');
		await downloadUrl(file.url, destPath);
	} catch (e) { // TODO: 何度か再試行
		if (e instanceof Error || typeof e === 'string') {
			logger.error(e);
		}
		throw e;
	}

	const outputPath = path + '/emojis';
	const unzipStream = fs.createReadStream(destPath);

	// Security: Validate paths to prevent ZIP Slip
	const extractor = unzipper.Extract({ path: outputPath });

	// Track extracted files for validation
	const extractedFiles: string[] = [];

	extractor.on('entry', (entry: unzipper.Entry) => {
		const filePath = path.join(outputPath, entry.path);

		// Security: Prevent path traversal (ZIP Slip vulnerability)
		const normalizedPath = path.normalize(filePath);
		if (!normalizedPath.startsWith(path.normalize(outputPath))) {
			logger.error(`Path traversal attempt detected: ${entry.path}`);
			extractor.emit('error', new Error('Path traversal detected'));
			extractor.removeListener('close');
			entry.autodrain();
			return;
		}

		extractedFiles.push(entry.path);
	});

	extractor.on('close', async () => {
		try {
			// Security: Validate JSON structure before parsing
			const metaPath = path.join(outputPath, 'meta.json');

			// Verify the file exists and is in the expected location
			if (!extractedFiles.includes('meta.json')) {
				throw new Error('Invalid emoji archive: missing meta.json');
			}

			const metaRaw = fs.readFileSync(metaPath, 'utf-8');

			// Security: Sanitize object to prevent prototype pollution
			let rawMeta;
			try {
				rawMeta = JSON.parse(metaRaw);
			} catch (e) {
				throw new Error('Invalid JSON format in meta.json');
			}

			const meta = sanitizeObject(rawMeta) as { emojis?: any[] };

			// Security: Validate structure
			if (!meta.emojis || !Array.isArray(meta.emojis)) {
				throw new Error('Invalid metadata structure: missing or invalid emojis array');
			}

			for (const record of meta.emojis) {
				if (!record.downloaded) continue;

				// Security: Validate record structure
				if (!record.emoji || !record.fileName) {
					logger.warn('Skipping invalid emoji record');
					continue;
				}

				const emojiInfo = record.emoji;

				// Security: Validate file path
				if (!extractedFiles.includes(record.fileName)) {
					logger.warn(`Skipping missing file: ${record.fileName}`);
					continue;
				}

				const emojiPath = path.join(outputPath, record.fileName);

				// Security: Verify the file is still within the output directory
				const normalizedPath = path.normalize(emojiPath);
				if (!normalizedPath.startsWith(path.normalize(outputPath))) {
					logger.warn(`Skipping invalid path: ${record.fileName}`);
					continue;
				}

				await Emojis.delete({
					name: emojiInfo.name,
				});
				const driveFile = await addFile({ user: null, path: emojiPath, name: record.fileName, force: true });
				const emoji = await Emojis.insert({
					id: genId(),
					updatedAt: new Date(),
					name: emojiInfo.name,
					category: emojiInfo.category,
					host: null,
					aliases: emojiInfo.aliases,
					originalUrl: driveFile.url,
					publicUrl: driveFile.webpublicUrl ?? driveFile.url,
					type: driveFile.webpublicType ?? driveFile.type,
				}).then(x => Emojis.findOneByOrFail(x.identifiers[0]));
			}

			await db.queryResultCache!.remove(['meta_emojis']);

			cleanup();

			logger.succ('Imported');
			done();
		} catch (e) {
			logger.error(`Error during emoji import: ${e.message}`);
			cleanup();
			done(e);
		}
	});

	extractor.on('error', (e: Error) => {
		logger.error(`Extraction error: ${e.message}`);
		cleanup();
		done(e);
	});

	unzipStream.pipe(extractor);
	logger.succ(`Unzipping to ${outputPath}`);
}
