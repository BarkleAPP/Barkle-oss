import Logger from '../logger.js';
import { getLogPath } from '@/misc/logging-config.js';

export const driveLogger = new Logger('drive', 'blue', true, getLogPath('drive.log'));
