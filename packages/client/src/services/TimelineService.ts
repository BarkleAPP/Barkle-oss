/**
 * Timeline Service - Enhanced Timeline Management for A/B Testing
 * Provides fresh content mixing and session management
 */

import * as os from '@/os';

export interface TimelineOptions {
  limit?: number;
  sinceId?: string;
  untilId?: string;
  withFiles?: boolean;
  algorithmVersion?: string;
  useAdvancedAlgorithm?: boolean;
  diversityLevel?: number;
  forceRefresh?: boolean;
}

export interface EnhancedTimelineResult {
  notes: any[];
  cursor?: string;
  hasMore?: boolean;
  batchSize?: number;
  sessionId?: string;
  _algorithmMetadata?: {
    totalProcessed: number;
    diversityScore: number;
    processingTimeMs: number;
    algorithmVersion: string;
    mixerEnabled: boolean;
    legacyMode: boolean;
    abTestVariant?: any;
  };
}

/**
 * Enhanced Timeline Service with A/B Testing Support
 */
export class TimelineService {
  private static instance: TimelineService;
  private sessionId: string;
  private refreshCount = 0;
  private lastRefreshTime = 0;

  private constructor() {
    this.sessionId = this.generateSessionId();
  }

  public static getInstance(): TimelineService {
    if (!TimelineService.instance) {
      TimelineService.instance = new TimelineService();
    }
    return TimelineService.instance;
  }

  /**
   * Get timeline with enhanced mixing and A/B testing
   */
  public async getTimeline(options: TimelineOptions = {}): Promise<EnhancedTimelineResult> {
    const now = Date.now();
    const timeSinceLastRefresh = now - this.lastRefreshTime;
    
    // Auto-refresh session every 30 minutes or on manual refresh
    if (timeSinceLastRefresh > 30 * 60 * 1000 || options.forceRefresh) {
      this.refreshSession();
    }
    
    this.refreshCount++;
    this.lastRefreshTime = now;
    
    try {
      // Enhanced API call with mixer support
      const result = await os.api('barks/recommended-timeline', {
        limit: options.limit || 20,
        sinceId: options.sinceId,
        untilId: options.untilId,
        withFiles: options.withFiles || false,
        algorithmVersion: options.algorithmVersion || 'ml',
        useAdvancedAlgorithm: options.useAdvancedAlgorithm !== false,
        useMicroservice: true,
        diversityLevel: options.diversityLevel || 0.2,
        enhancedFormat: true, // Request enhanced format
        sessionId: this.sessionId,
        forceRefresh: options.forceRefresh || false,
        enableMixer: true, // Enable timeline mixer
      });
      
      // Handle both legacy array format and enhanced object format
      if (Array.isArray(result)) {
        // Legacy format - convert to enhanced format
        return {
          notes: result,
          hasMore: result.length >= (options.limit || 20),
          batchSize: result.length,
        };
      }
      
      // Enhanced format with metadata
      return result as EnhancedTimelineResult;
      
    } catch (error) {
      console.error('Timeline fetch failed:', error);
      
      // Fallback to basic timeline
      try {
        const fallbackResult = await os.api('barks/recommended-timeline', {
          limit: options.limit || 20,
          sinceId: options.sinceId,
          untilId: options.untilId,
          algorithmVersion: 'legacy',
        });
        
        return {
          notes: Array.isArray(fallbackResult) ? fallbackResult : fallbackResult.notes || [],
          hasMore: false,
          batchSize: Array.isArray(fallbackResult) ? fallbackResult.length : fallbackResult.notes?.length || 0,
        };
      } catch (fallbackError) {
        console.error('Fallback timeline also failed:', fallbackError);
        return {
          notes: [],
          hasMore: false,
          batchSize: 0,
        };
      }
    }
  }

  /**
   * Force refresh timeline cache
   */
  public async forceRefresh(): Promise<void> {
    try {
      await os.api('algorithm/refresh-timeline', {
        action: 'refresh_user'
      });
      
      // Generate new session ID for fresh content
      this.refreshSession();
      
    } catch (error) {
      console.error('Failed to refresh timeline cache:', error);
      // Still refresh session ID for client-side freshness
      this.refreshSession();
    }
  }

  /**
   * Get fresh timeline (bypasses cache)
   */
  public async getFreshTimeline(options: TimelineOptions = {}): Promise<EnhancedTimelineResult> {
    return this.getTimeline({
      ...options,
      forceRefresh: true
    });
  }

  /**
   * Get timeline with specific diversity level
   */
  public async getTimelineWithDiversity(diversityLevel: number, options: TimelineOptions = {}): Promise<EnhancedTimelineResult> {
    return this.getTimeline({
      ...options,
      diversityLevel: Math.max(0, Math.min(1, diversityLevel)) // Clamp between 0 and 1
    });
  }

  /**
   * Generate new session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `client_${timestamp}_${random}`;
  }

  /**
   * Refresh session for new content
   */
  private refreshSession(): void {
    this.sessionId = this.generateSessionId();
    this.refreshCount = 0;
    this.lastRefreshTime = Date.now();
  }

  /**
   * Get current session info
   */
  public getSessionInfo(): {
    sessionId: string;
    refreshCount: number;
    sessionAge: number;
  } {
    return {
      sessionId: this.sessionId,
      refreshCount: this.refreshCount,
      sessionAge: Date.now() - this.lastRefreshTime
    };
  }

  /**
   * Check if timeline should be refreshed
   */
  public shouldRefresh(): boolean {
    const sessionAge = Date.now() - this.lastRefreshTime;
    return sessionAge > 15 * 60 * 1000; // Suggest refresh after 15 minutes
  }
}

// Export singleton instance
export const timelineService = TimelineService.getInstance();

// Export for use in components
export default timelineService;