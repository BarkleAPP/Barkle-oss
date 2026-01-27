import Logger from '@/services/logger.js';
import { getLogPath } from '@/misc/logging-config.js';

export const apiLogger = new Logger('api', undefined, true, getLogPath('api-access.log'));
