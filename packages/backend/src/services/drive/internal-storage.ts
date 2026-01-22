import * as fs from 'node:fs';
import * as Path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import config from '@/config/index.js';

const _filename = fileURLToPath(import.meta.url);
const _dirname = dirname(_filename);

/**
 * Validate file key to prevent path traversal attacks
 * - Blocks path traversal sequences (.., ., etc.)
 * - Blocks absolute paths
 * - Only allows alphanumeric, hyphen, underscore, and dot characters
 */
function validateFileKey(key: string): boolean {
	// Block null/undefined
	if (!key || typeof key !== 'string') {
		return false;
	}

	// Block empty strings
	if (key.trim().length === 0) {
		return false;
	}

	// Block path traversal sequences
	if (key.includes('..') || key.includes('./') || key.includes('.\\')) {
		return false;
	}

	// Block absolute paths
	if (Path.isAbsolute(key)) {
		return false;
	}

	// Only allow safe characters: alphanumeric, hyphen, underscore, forward slash, and dot (for extensions)
	// This pattern allows paths like "abc-123/def_456.png" but blocks malicious patterns
	const safePattern = /^[a-zA-Z0-9/_\-\.]+$/;

	if (!safePattern.test(key)) {
		return false;
	}

	// Ensure the normalized path doesn't escape the base directory
	const resolvedPath = Path.resolve(Path.resolve(_dirname, '../../../../../files'), key);
	const basePath = Path.resolve(_dirname, '../../../../../files');

	if (!resolvedPath.startsWith(basePath)) {
		return false;
	}

	return true;
}

export class InternalStorage {
	private static readonly path = Path.resolve(_dirname, '../../../../../files');

	public static resolvePath = (key: string) => {
		// Validate key before resolving path
		if (!validateFileKey(key)) {
			throw new Error(`Invalid file key: ${key}`);
		}
		return Path.resolve(InternalStorage.path, key);
	};

	public static read(key: string) {
		return fs.createReadStream(InternalStorage.resolvePath(key));
	}

	public static saveFromPath(key: string, srcPath: string) {
		fs.mkdirSync(InternalStorage.path, { recursive: true });
		fs.copyFileSync(srcPath, InternalStorage.resolvePath(key));
		return `${config.url}/files/${key}`;
	}

	public static saveFromBuffer(key: string, data: Buffer) {
		fs.mkdirSync(InternalStorage.path, { recursive: true });
		fs.writeFileSync(InternalStorage.resolvePath(key), data);
		return `${config.url}/files/${key}`;
	}

	public static del(key: string) {
		fs.unlink(InternalStorage.resolvePath(key), () => {});
	}
}
