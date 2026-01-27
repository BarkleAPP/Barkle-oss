import path from 'node:path';
import fs from 'node:fs';

/**
 * Centralized logging configuration
 * Ensures logs directory exists and provides paths for all log files
 */

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
	fs.mkdirSync(logsDir, { recursive: true, mode: 0o755 });
}

// Pre-create log files with correct permissions
const logFiles = [
	'app.log',
	'server.log',
	'api-access.log',
	'queue.log',
	'db.log',
	'drive.log',
];

for (const file of logFiles) {
	const filePath = path.join(logsDir, file);
	if (!fs.existsSync(filePath)) {
		fs.writeFileSync(filePath, '', { mode: 0o600 });
	}
}

/**
 * Get the full path for a log file
 */
export function getLogPath(filename: string): string {
	return path.join(logsDir, filename);
}

/**
 * Get the logs directory path
 */
export function getLogsDir(): string {
	return logsDir;
}
