import Logger from '@/services/logger.js';
import { getLogPath } from '@/misc/logging-config.js';

export const queueLogger = new Logger('queue', 'orange', true, getLogPath('queue.log'));
