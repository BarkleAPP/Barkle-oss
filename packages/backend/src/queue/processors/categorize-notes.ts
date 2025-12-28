/**
 * Background job to categorize uncategorized notes
 */

import { contentCategorizationService } from '@/services/algorithm/content-categorization-service.js';
import Logger from '@/services/logger.js';

const logger = new Logger('categorize-notes-job');

export default async function categorizeNotesJob(): Promise<void> {
  try {
    logger.info('Starting background note categorization job');
    
    const categorizedCount = await contentCategorizationService.categorizeUncategorizedNotes(200);
    
    logger.info(`Background categorization completed: ${categorizedCount} notes categorized`);
  } catch (error) {
    logger.error('Background note categorization failed:', error as any);
    throw error;
  }
}