/**
 * Scalable Timeline Service Adapter
 * Simple adapter for timeline engagement tracking from the backend
 * 
 * This file bridges between backend events and the algorithm service's
 * engagement tracking for timeline improvements
 */

import { algorithmClient } from './algorithm-microservice-client.js';
import Logger from '@/services/logger.js';

const logger = new Logger('scalable-timeline-adapter');

export class ScalableTimelineService {
  /**
   * Record an engagement event for ML timeline ranking
   */
  static async recordEngagement(
    noteId: string,
    userId: string,
    engagementType: 'reaction' | 'reply' | 'renote' | 'view' | 'share'
  ): Promise<void> {
    try {
      await algorithmClient.recordEngagement(
        userId,
        noteId,
        engagementType,
        {
          source: 'timeline',
          timestamp: new Date()
        }
      );

      logger.debug(`Timeline engagement recorded: ${userId} -> ${noteId} (${engagementType})`);
    } catch (error) {
      logger.error('Failed to record timeline engagement:', error as Error);
      // Don't throw - tracking should not block user actions
    }
  }

  /**
   * Record a view impression for ML learning
   */
  static async recordImpression(
    noteId: string,
    userId: string,
    metadata?: {
      position?: number;
      dwellTimeMs?: number;
      scrollDepth?: number;
    }
  ): Promise<void> {
    try {
      await algorithmClient.recordEngagement(
        userId,
        noteId,
        'view',
        {
          source: 'timeline',
          ...metadata,
          timestamp: new Date()
        }
      );

      logger.debug(`Timeline impression recorded: ${userId} viewed ${noteId}`);
    } catch (error) {
      logger.error('Failed to record timeline impression:', error as Error);
      // Don't throw - tracking should not block rendering
    }
  }
}
