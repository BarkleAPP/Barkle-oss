/**
 * Cache Invalidation Hooks
 * Simple adapter for cache invalidation events from the backend
 * 
 * This file bridges between the backend's note creation/reaction events
 * and the algorithm service's cache/signal tracking
 */

import { algorithmClient } from './algorithm-microservice-client.js';
import Logger from '@/services/logger.js';

const logger = new Logger('cache-invalidation-hooks');

export class CacheInvalidationHooks {
  /**
   * Called when a note is created
   * Invalidates timeline caches for followers and tracks signals
   */
  static async onNoteCreate(userId: string, noteId: string): Promise<void> {
    try {
      // Record engagement signal for the user who created the note
      await algorithmClient.recordEngagement(
        userId,
        noteId,
        'view', // Consider creation as a "view" of own content
        {
          action: 'note_create',
          timestamp: new Date()
        }
      );

      logger.debug(`Cache invalidated for note creation: ${noteId} by user ${userId}`);
    } catch (error) {
      logger.error('Failed to invalidate cache on note create:', error as Error);
      // Don't throw - cache invalidation should not block note creation
    }
  }

  /**
   * Called when a note receives a reaction
   * Invalidates caches and tracks engagement signals
   */
  static async onNoteReaction(
    reactorId: string,
    noteId: string,
    noteAuthorId: string
  ): Promise<void> {
    try {
      // Record reaction engagement
      await algorithmClient.recordEngagement(
        reactorId,
        noteId,
        'reaction',
        {
          noteAuthorId,
          timestamp: new Date()
        }
      );

      logger.debug(`Cache invalidated for reaction: ${noteId} by ${reactorId}`);
    } catch (error) {
      logger.error('Failed to invalidate cache on note reaction:', error as Error);
      // Don't throw - cache invalidation should not block reactions
    }
  }

  /**
   * Called when a note is replied to
   * Invalidates caches and tracks reply signals
   */
  static async onNoteReply(
    replierId: string,
    noteId: string,
    originalNoteId: string
  ): Promise<void> {
    try {
      // Record reply engagement
      await algorithmClient.recordEngagement(
        replierId,
        originalNoteId,
        'reply',
        {
          replyNoteId: noteId,
          timestamp: new Date()
        }
      );

      logger.debug(`Cache invalidated for reply: ${noteId} to ${originalNoteId}`);
    } catch (error) {
      logger.error('Failed to invalidate cache on note reply:', error as Error);
      // Don't throw - cache invalidation should not block replies
    }
  }

  /**
   * Called when a note is renoted
   * Invalidates caches and tracks renote signals
   */
  static async onNoteRenote(
    renoterId: string,
    noteId: string,
    originalNoteId: string
  ): Promise<void> {
    try {
      // Record renote engagement
      await algorithmClient.recordEngagement(
        renoterId,
        originalNoteId,
        'renote',
        {
          renoteNoteId: noteId,
          timestamp: new Date()
        }
      );

      logger.debug(`Cache invalidated for renote: ${noteId} of ${originalNoteId}`);
    } catch (error) {
      logger.error('Failed to invalidate cache on note renote:', error as Error);
      // Don't throw - cache invalidation should not block renotes
    }
  }

  /**
   * Called when a note is shared (new feature)
   * Tracks share signals for algorithm boosting (Instagram-style)
   */
  static async onNoteShare(
    sharerId: string,
    noteId: string,
    noteAuthorId: string,
    shareMethod: 'copy_link' | 'native_share' | 'embed'
  ): Promise<void> {
    try {
      // Record share engagement - this is a STRONG signal
      await algorithmClient.recordEngagement(
        sharerId,
        noteId,
        'share',
        {
          noteAuthorId,
          shareMethod,
          timestamp: new Date(),
          // Shares are weighted heavily in the algorithm
          signalWeight: 2.0
        }
      );

      logger.info(`Share tracked: ${noteId} by ${sharerId} via ${shareMethod}`);
    } catch (error) {
      logger.error('Failed to track share:', error as Error);
      // Don't throw - tracking should not block shares
    }
  }
}
