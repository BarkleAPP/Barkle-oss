/**
 * Algorithm Signal Service
 * Automatically collects user interaction signals for algorithm learning
 */

import * as os from '@/os';

/**
 * Signal types that can be collected
 */
export type SignalType = 
  | 'note_view' 
  | 'note_reaction' 
  | 'note_reply' 
  | 'note_renote' 
  | 'note_share'
  | 'note_bookmark'
  | 'profile_view'
  | 'timeline_view'
  | 'search_query'
  | 'follow_action'
  | 'dwell_time'
  | 'scroll_depth';

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
  reactionType?: string;
  searchQuery?: string;
  action?: string;
  [key: string]: any;
}

/**
 * Collected signal for batching
 */
interface CollectedSignal {
  type: SignalType;
  contentId: string;
  context: SignalContext;
  timestamp: number;
}

/**
 * Algorithm Signal Service
 */
export class AlgorithmSignalService {
  private static instance: AlgorithmSignalService;
  private signalBuffer: CollectedSignal[] = [];
  private sessionId: string;
  private flushInterval?: number;
  private viewStartTimes = new Map<string, number>();
  private isEnabled = true;

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.startAutoFlush();
    this.setupVisibilityHandlers();
  }

  public static getInstance(): AlgorithmSignalService {
    if (!AlgorithmSignalService.instance) {
      AlgorithmSignalService.instance = new AlgorithmSignalService();
    }
    return AlgorithmSignalService.instance;
  }

  /**
   * Enable or disable signal collection
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Collect a user interaction signal
   */
  public collectSignal(
    type: SignalType,
    contentId: string,
    context: SignalContext = {}
  ): void {
    if (!this.isEnabled) return;

    const signal: CollectedSignal = {
      type,
      contentId,
      context: {
        ...context,
        sessionId: this.sessionId,
        deviceType: this.getDeviceType(),
        referrer: document.referrer || undefined
      },
      timestamp: Date.now()
    };

    this.signalBuffer.push(signal);

    // Auto-flush if buffer is getting large
    if (this.signalBuffer.length >= 50) {
      this.flushSignals();
    }
  }

  /**
   * Track note view with automatic dwell time calculation
   */
  public trackNoteView(noteId: string, context: SignalContext = {}): void {
    this.viewStartTimes.set(noteId, Date.now());
    
    this.collectSignal('note_view', noteId, {
      ...context,
      viewStart: true
    });
  }

  /**
   * Track note view end and calculate dwell time
   */
  public trackNoteViewEnd(noteId: string, context: SignalContext = {}): void {
    const startTime = this.viewStartTimes.get(noteId);
    if (startTime) {
      const dwellTimeMs = Date.now() - startTime;
      this.viewStartTimes.delete(noteId);
      
      this.collectSignal('dwell_time', noteId, {
        ...context,
        dwellTimeMs,
        viewEnd: true
      });
    }
  }

  /**
   * Track timeline scroll with visible notes
   */
  public trackTimelineScroll(visibleNoteIds: string[], scrollDepth: number, context: SignalContext = {}): void {
    for (let i = 0; i < visibleNoteIds.length; i++) {
      this.collectSignal('scroll_depth', visibleNoteIds[i], {
        ...context,
        scrollDepth,
        timelinePosition: i,
        totalVisible: visibleNoteIds.length
      });
    }
  }

  /**
   * Track reaction with sentiment
   */
  public trackReaction(noteId: string, reactionType: string, context: SignalContext = {}): void {
    this.collectSignal('note_reaction', noteId, {
      ...context,
      reactionType,
      sentiment: this.getReactionSentiment(reactionType)
    });
  }

  /**
   * Track search interaction
   */
  public trackSearch(query: string, resultIds: string[] = [], clickedId?: string, context: SignalContext = {}): void {
    this.collectSignal('search_query', query, {
      ...context,
      resultCount: resultIds.length,
      hasClick: !!clickedId
    });

    if (clickedId) {
      this.collectSignal('note_view', clickedId, {
        ...context,
        source: 'search',
        searchQuery: query
      });
    }
  }

  /**
   * Track follow/unfollow action
   */
  public trackFollowAction(userId: string, action: 'follow' | 'unfollow', context: SignalContext = {}): void {
    this.collectSignal('follow_action', userId, {
      ...context,
      action
    });
  }

  /**
   * Track timeline view
   */
  public trackTimelineView(timelineType: string = 'hybrid', context: SignalContext = {}): void {
    this.collectSignal('timeline_view', timelineType, {
      ...context,
      timelineType
    });
  }

  /**
   * Flush signals to server
   */
  public async flushSignals(): Promise<void> {
    if (this.signalBuffer.length === 0) return;

    try {
      const signals = this.signalBuffer.splice(0); // Clear buffer
      
      await os.api('algorithm/collect-signals', {
        signals: signals.map(signal => ({
          type: signal.type,
          contentId: signal.contentId,
          context: signal.context
        }))
      });

      console.debug(`Flushed ${signals.length} algorithm signals`);

    } catch (error) {
      console.error('Failed to flush algorithm signals:', error);
      
      // Put signals back in buffer for retry (keep only recent ones)
      if (this.signalBuffer.length < 100) {
        this.signalBuffer.unshift(...signals.slice(-50));
      }
    }
  }

  /**
   * Get current signal buffer stats
   */
  public getStats(): {
    bufferedSignals: number;
    sessionId: string;
    activeViews: number;
  } {
    return {
      bufferedSignals: this.signalBuffer.length,
      sessionId: this.sessionId,
      activeViews: this.viewStartTimes.size
    };
  }

  /**
   * Start automatic signal flushing
   */
  private startAutoFlush(): void {
    // Flush signals every 30 seconds
    this.flushInterval = window.setInterval(() => {
      this.flushSignals();
    }, 30000);
  }

  /**
   * Setup page visibility handlers
   */
  private setupVisibilityHandlers(): void {
    // Flush signals when page becomes hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.flushSignals();
        
        // End all active view tracking
        for (const [noteId] of this.viewStartTimes) {
          this.trackNoteViewEnd(noteId, { reason: 'page_hidden' });
        }
      }
    });

    // Flush signals before page unload
    window.addEventListener('beforeunload', () => {
      this.flushSignals();
    });
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Detect device type
   */
  private getDeviceType(): 'mobile' | 'desktop' | 'tablet' {
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent)) {
      return 'mobile';
    } else if (/tablet|ipad/i.test(userAgent)) {
      return 'tablet';
    } else {
      return 'desktop';
    }
  }

  /**
   * Get reaction sentiment
   */
  private getReactionSentiment(reactionType: string): 'positive' | 'negative' | 'neutral' {
    const positiveReactions = ['👍', '❤️', '😍', '🎉', '👏', '🔥', 'like', 'love'];
    const negativeReactions = ['👎', '😢', '😡', '💔', 'dislike', 'angry'];
    
    if (positiveReactions.some(r => reactionType.includes(r))) return 'positive';
    if (negativeReactions.some(r => reactionType.includes(r))) return 'negative';
    return 'neutral';
  }

  /**
   * Cleanup and shutdown
   */
  public destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    
    // Final flush
    this.flushSignals();
  }
}

// Export singleton instance
export const algorithmSignalService = AlgorithmSignalService.getInstance();