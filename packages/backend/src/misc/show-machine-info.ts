import * as os from 'node:os';
import sysUtils from 'systeminformation';
import Logger from '@/services/logger.js';

export async function showMachineInfo(parentLogger: Logger) {
	const logger = parentLogger.createSubLogger('machine');
	logger.debug(`Hostname: ${os.hostname()}`);
	logger.debug(`Platform: ${process.platform} Arch: ${process.arch}`);

	try {
		const mem = await sysUtils.mem();
		const totalmem = (mem.total / 1024 / 1024 / 1024).toFixed(1);
		const availmem = (mem.available / 1024 / 1024 / 1024).toFixed(1);
		logger.debug(`MEM: ${totalmem}GB (available: ${availmem}GB)`);
	} catch (error) {
		logger.debug('MEM: Unable to detect memory info');
	}

	try {
		const cpus = os.cpus();
		logger.debug(`CPU: ${cpus.length} core`);
	} catch (error) {
		logger.debug('CPU: Unable to detect CPU info');
	}
}
