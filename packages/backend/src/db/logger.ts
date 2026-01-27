import Logger from '@/services/logger.js';
import { getLogPath } from '@/misc/logging-config.js';

export const dbLogger = new Logger('db', undefined, true, getLogPath('db.log'));
