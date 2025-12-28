/**
 * Signal Collection Service
 * Collects user interaction signals from existing endpoints for algorithm learning
 */

import { algorithmClient } from './algorithm-microservice-client.js';
import Logger from '@/services/logger.js';

const logger = new Logger('signal-collection-service');

/**
 * User interaction signal types
 */
export type SignalType =
  | 'note_view'
  | 'note_reaction'
  | 'note_reply'
  | 'note_renote'
  | 'note_share'        // ✅ Share tracking (Instagram-style boost)
  | 'note_bookmark'
  | 'profile_view'
  | 'timeline_view'
  | 'search_query'
  | 'follow_action'
  | 'mute'
  | 'block'
  | 'dwell_time'
  | 'scroll_depth'
  | 'external_share';   // ✅ NEW: Share to external platforms (even more valuable)

/**
 * Signal context information
 */
export interface SignalContext {
  source?: 'timeline' | 'search' | 'notification' | 'profile' | 'direct';
  deviceType?: 'mobile' | 'desktop' | 'tablet';
  timelinePosition?: number;
  dwellTimeMs?: number;
  scrollDepth?: number;
  sessionId?: string;
  referrer?: string;
  // ✅ NEW: Share tracking metadata
  shareDestination?: 'copy_link' | 'twitter' | 'facebook' | 'reddit' | 'email' | 'other';
  shareMethod?: 'button' | 'context_menu' | 'keyboard_shortcut';
  [key: string]: any;
}

/**
 * Signal Collection Service
 * Integrates with existing endpoints to collect user behavior signals
 */
export class SignalCollectionService {
  private static instance: SignalCollectionService;
  private signalBuffer: Map<string, any[]> = new Map();
  private flushInterval?: NodeJS.Timeout;

  private constructor() {
    // Start periodic signal flushing
    this.startSignalFlushing();
  }

  public static getInstance(): SignalCollectionService {
    if (!SignalCollectionService.instance) {
      SignalCollectionService.instance = new SignalCollectionService();
    }
    return SignalCollectionService.instance;
  }

  /**
   * Collect a user interaction signal
   */
  public async collectSignal(
    userId: string,
    signalType: SignalType,
    contentId: string,
    context: SignalContext = {}
  ): Promise<void> {
    try {
      const signal = {
        userId,
        signalType,
        contentId,
        context: {
          ...context,
          timestamp: new Date().toISOString(),
          userAgent: context.userAgent || 'unknown'
        }
      };

      // Add to buffer for batch processing
      const userSignals = this.signalBuffer.get(userId) || [];
      userSignals.push(signal);
      this.signalBuffer.set(userId, userSignals);

      // Also send immediately for real-time learning
      await algorithmClient.recordEngagement(
        userId,
        contentId,
        this.mapSignalToEngagementType(signalType),
        context
      );

      logger.debug(`Signal collected: ${signalType} for user ${userId} on content ${contentId}`);

    } catch (error) {
      logger.error('Failed to collect signal:', error as Error);
    }
  }

  /**
   * Collect note view signal with dwell time
   */
  public async collectNoteView(
    userId: string,
    noteId: string,
    dwellTimeMs: number,
    context: SignalContext = {}
  ): Promise<void> {
    await this.collectSignal(userId, 'note_view', noteId, {
      ...context,
      dwellTimeMs,
      engagementStrength: this.calculateEngagementStrength(dwellTimeMs)
    });
  }

  /**
   * Collect timeline scroll signal
   */
  public async collectTimelineScroll(
    userId: string,
    scrollDepth: number,
    visibleNoteIds: string[],
    context: SignalContext = {}
  ): Promise<void> {
    // Collect signals for all visible notes
    for (let i = 0; i < visibleNoteIds.length; i++) {
      await this.collectSignal(userId, 'note_view', visibleNoteIds[i], {
        ...context,
        scrollDepth,
        timelinePosition: i,
        viewType: 'scroll'
      });
    }
  }

  /**
   * Collect search interaction signal
   */
  public async collectSearchInteraction(
    userId: string,
    query: string,
    resultNoteIds: string[],
    clickedNoteId?: string,
    context: SignalContext = {}
  ): Promise<void> {
    // Collect search query signal
    await this.collectSignal(userId, 'search_query', query, {
      ...context,
      resultCount: resultNoteIds.length,
      hasClick: !!clickedNoteId
    });

    // If user clicked on a result, collect that signal
    if (clickedNoteId) {
      await this.collectSignal(userId, 'note_view', clickedNoteId, {
        ...context,
        source: 'search',
        searchQuery: query
      });
    }
  }

  /**
   * Collect reaction signal with sentiment
   */
  public async collectReaction(
    userId: string,
    noteId: string,
    reactionType: string,
    context: SignalContext = {}
  ): Promise<void> {
    await this.collectSignal(userId, 'note_reaction', noteId, {
      ...context,
      reactionType,
      sentiment: this.getReactionSentiment(reactionType)
    });
  }

  /**
   * Collect follow/unfollow signal
   */
  public async collectFollowAction(
    userId: string,
    targetUserId: string,
    action: 'follow' | 'unfollow',
    context: SignalContext = {}
  ): Promise<void> {
    await this.collectSignal(userId, 'follow_action', targetUserId, {
      ...context,
      action,
      relationshipChange: action === 'follow' ? 1 : -1
    });
  }

  /**
   * Batch process signals for algorithm training
   */
  public async flushSignals(): Promise<void> {
    if (this.signalBuffer.size === 0) return;

    try {
      const totalSignals = Array.from(this.signalBuffer.values())
        .reduce((sum, signals) => sum + signals.length, 0);

      logger.info(`Flushing ${totalSignals} signals for ${this.signalBuffer.size} users`);

      // In production, this would send to algorithm training pipeline
      // For now, we'll just log the aggregated signals
      for (const [userId, signals] of this.signalBuffer.entries()) {
        const signalSummary = this.aggregateUserSignals(signals);
        logger.debug(`User ${userId} signals:`, signalSummary);
      }

      // Clear buffer
      this.signalBuffer.clear();

    } catch (error) {
      logger.error('Failed to flush signals:', error as Error);
    }
  }

  /**
   * Get signal statistics
   */
  public getStats(): {
    bufferedSignals: number;
    bufferedUsers: number;
    signalTypes: Record<string, number>;
  } {
    const signalTypes: Record<string, number> = {};
    let totalSignals = 0;

    for (const signals of this.signalBuffer.values()) {
      totalSignals += signals.length;
      for (const signal of signals) {
        signalTypes[signal.signalType] = (signalTypes[signal.signalType] || 0) + 1;
      }
    }

    return {
      bufferedSignals: totalSignals,
      bufferedUsers: this.signalBuffer.size,
      signalTypes
    };
  }

  /**
   * Start periodic signal flushing
   */
  private startSignalFlushing(): void {
    // Flush signals every 5 minutes
    this.flushInterval = setInterval(() => {
      this.flushSignals().catch(error => {
        logger.error('Signal flush failed:', error);
      });
    }, 5 * 60 * 1000);
  }

  /**
   * Map signal type to engagement type for algorithm client
   */
  private mapSignalToEngagementType(signalType: SignalType): 'reaction' | 'reply' | 'renote' | 'view' | 'share' {
    switch (signalType) {
      case 'note_reaction':
        return 'reaction';
      case 'note_reply':
        return 'reply';
      case 'note_renote':
        return 'renote';
      case 'note_share':
      case 'external_share':
      case 'note_bookmark':
        return 'share';
      default:
        return 'view';
    }
  }

  /**
   * Calculate engagement strength based on dwell time
   */
  private calculateEngagementStrength(dwellTimeMs: number): number {
    // Convert dwell time to engagement strength (0-1)
    if (dwellTimeMs < 1000) return 0.1; // Quick scroll
    if (dwellTimeMs < 3000) return 0.3; // Brief view
    if (dwellTimeMs < 10000) return 0.6; // Engaged view
    if (dwellTimeMs < 30000) return 0.8; // Deep engagement
    return 1.0; // Very engaged
  }

  /**
   * Get sentiment from reaction type
   */
  private getReactionSentiment(reactionType: string): 'positive' | 'negative' | 'neutral' {
    const positiveReactions = ['👍', '❤️', '😍', '🎉', '👏', '🔥', 'like', 'love'];
    const negativeReactions = ['👎', '😢', '😡', '💔', 'dislike', 'angry'];

    if (positiveReactions.some(r => reactionType.includes(r))) return 'positive';
    if (negativeReactions.some(r => reactionType.includes(r))) return 'negative';
    return 'neutral';
  }

  /**
   * Aggregate user signals for analysis
   */
  private aggregateUserSignals(signals: any[]): Record<string, any> {
    const summary: Record<string, any> = {
      totalSignals: signals.length,
      signalTypes: {},
      avgDwellTime: 0,
      avgScrollDepth: 0,
      sentimentDistribution: { positive: 0, negative: 0, neutral: 0 }
    };

    let totalDwellTime = 0;
    let dwellTimeCount = 0;
    let totalScrollDepth = 0;
    let scrollDepthCount = 0;

    for (const signal of signals) {
      // Count signal types
      summary.signalTypes[signal.signalType] = (summary.signalTypes[signal.signalType] || 0) + 1;

      // Aggregate dwell time
      if (signal.context.dwellTimeMs) {
        totalDwellTime += signal.context.dwellTimeMs;
        dwellTimeCount++;
      }

      // Aggregate scroll depth
      if (signal.context.scrollDepth) {
        totalScrollDepth += signal.context.scrollDepth;
        scrollDepthCount++;
      }

      // Aggregate sentiment
      if (signal.context.sentiment) {
        summary.sentimentDistribution[signal.context.sentiment]++;
      }
    }

    summary.avgDwellTime = dwellTimeCount > 0 ? totalDwellTime / dwellTimeCount : 0;
    summary.avgScrollDepth = scrollDepthCount > 0 ? totalScrollDepth / scrollDepthCount : 0;

    return summary;
  }

  /**
   * Cleanup and shutdown
   */
  public destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    // Flush remaining signals
    this.flushSignals().catch(error => {
      logger.error('Final signal flush failed:', error);
    });
  }
}

// Export singleton instance
export const signalCollectionService = SignalCollectionService.getInstance();