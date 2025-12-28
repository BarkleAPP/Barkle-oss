/**
 * Behavioral Pattern Recognition Service
 * Analyzes user behavior patterns for improved personalization
 */

import Logger from '@/services/logger.js';

const logger = new Logger('behavioral-pattern-recognition');

/**
 * Dwell time analysis result
 */
export interface DwellTimeAnalysis {
  averageDwellTime: number; // ms
  dwellTimeDistribution: {
    quick: number; // <1s
    brief: number; // 1-3s
    engaged: number; // 3-10s
    deep: number; // >10s
  };
  contentTypePreferences: Record<string, number>; // content type -> avg dwell time
  timeOfDayPatterns: Record<number, number>; // hour -> avg dwell time
  confidence: number;
}

/**
 * Scroll pattern analysis result
 */
export interface ScrollPatternAnalysis {
  averageScrollDepth: number; // 0-1
  scrollVelocity: number; // pixels per second
  scrollBehavior: 'scanner' | 'reader' | 'browser' | 'searcher';
  pausePoints: number[]; // scroll depths where user pauses
  backtrackFrequency: number; // how often user scrolls back up
  confidence: number;
}

/**
 * Engagement sequence analysis result
 */
export interface EngagementSequenceAnalysis {
  commonSequences: Array<{
    sequence: string[]; // e.g., ['view', 'react', 'share']
    frequency: number;
    avgTimespan: number; // ms between first and last action
  }>;
  engagementDepth: 'shallow' | 'moderate' | 'deep';
  sessionPatterns: {
    avgSessionLength: number; // ms
    actionsPerSession: number;
    peakActivityHours: number[];
  };
  confidence: number;
}

/**
 * Temporal behavior analysis result
 */
export interface TemporalBehaviorAnalysis {
  activeHours: number[]; // hours of day when most active
  dayOfWeekPatterns: Record<string, number>; // day -> activity level
  seasonalPatterns: Record<string, number>; // season -> activity level
  activityRhythm: 'morning' | 'afternoon' | 'evening' | 'night' | 'irregular';
  consistencyScore: number; // 0-1, how consistent the patterns are
  confidence: number;
}

/**
 * User behavior signal
 */
export interface BehaviorSignal {
  userId: string;
  timestamp: Date;
  signalType: string;
  contentId: string;
  dwellTimeMs?: number;
  scrollDepth?: number;
  scrollVelocity?: number;
  sequencePosition?: number;
  sessionId?: string;
  context?: Record<string, any>;
}

/**
 * Behavioral Pattern Recognition Service
 */
export class BehavioralPatternRecognition {
  private static instance: BehavioralPatternRecognition;
  private userSignals = new Map<string, BehaviorSignal[]>();
  private dwellTimeCache = new Map<string, DwellTimeAnalysis>();
  private scrollPatternCache = new Map<string, ScrollPatternAnalysis>();
  private engagementCache = new Map<string, EngagementSequenceAnalysis>();
  private temporalCache = new Map<string, TemporalBehaviorAnalysis>();

  private constructor() {
    // Start periodic cache cleanup
    this.startCacheCleanup();
  }

  public static getInstance(): BehavioralPatternRecognition {
    if (!BehavioralPatternRecognition.instance) {
      BehavioralPatternRecognition.instance = new BehavioralPatternRecognition();
    }
    return BehavioralPatternRecognition.instance;
  }

  /**
   * Add behavior signal for analysis
   */
  public addSignal(signal: BehaviorSignal): void {
    const userSignals = this.userSignals.get(signal.userId) || [];
    userSignals.push(signal);
    
    // Keep only recent signals (last 1000 per user)
    if (userSignals.length > 1000) {
      userSignals.splice(0, userSignals.length - 1000);
    }
    
    this.userSignals.set(signal.userId, userSignals);
    
    // Invalidate relevant caches
    this.invalidateUserCaches(signal.userId);
  }

  /**
   * Analyze dwell time patterns for user
   */
  public async analyzeDwellTimePatterns(userId: string): Promise<DwellTimeAnalysis> {
    // Check cache first
    const cached = this.dwellTimeCache.get(userId);
    if (cached) return cached;

    const signals = this.userSignals.get(userId) || [];
    const dwellTimeSignals = signals.filter(s => s.dwellTimeMs !== undefined);

    if (dwellTimeSignals.length < 10) {
      return this.createDefaultDwellTimeAnalysis();
    }

    // Calculate average dwell time
    const totalDwellTime = dwellTimeSignals.reduce((sum, s) => sum + (s.dwellTimeMs || 0), 0);
    const averageDwellTime = totalDwellTime / dwellTimeSignals.length;

    // Calculate distribution
    const distribution = { quick: 0, brief: 0, engaged: 0, deep: 0 };
    for (const signal of dwellTimeSignals) {
      const dwellTime = signal.dwellTimeMs || 0;
      if (dwellTime < 1000) distribution.quick++;
      else if (dwellTime < 3000) distribution.brief++;
      else if (dwellTime < 10000) distribution.engaged++;
      else distribution.deep++;
    }

    // Normalize distribution
    const total = dwellTimeSignals.length;
    for (const key in distribution) {
      distribution[key as keyof typeof distribution] /= total;
    }

    // Analyze content type preferences
    const contentTypePreferences: Record<string, number> = {};
    const contentTypeCounts: Record<string, number> = {};
    
    for (const signal of dwellTimeSignals) {
      const contentType = signal.context?.contentType || 'text';
      if (!contentTypePreferences[contentType]) {
        contentTypePreferences[contentType] = 0;
        contentTypeCounts[contentType] = 0;
      }
      contentTypePreferences[contentType] += signal.dwellTimeMs || 0;
      contentTypeCounts[contentType]++;
    }

    // Calculate averages
    for (const type in contentTypePreferences) {
      contentTypePreferences[type] /= contentTypeCounts[type];
    }

    // Analyze time of day patterns
    const timeOfDayPatterns: Record<number, number> = {};
    const timeOfDayCounts: Record<number, number> = {};
    
    for (const signal of dwellTimeSignals) {
      const hour = signal.timestamp.getHours();
      if (!timeOfDayPatterns[hour]) {
        timeOfDayPatterns[hour] = 0;
        timeOfDayCounts[hour] = 0;
      }
      timeOfDayPatterns[hour] += signal.dwellTimeMs || 0;
      timeOfDayCounts[hour]++;
    }

    // Calculate averages
    for (const hour in timeOfDayPatterns) {
      timeOfDayPatterns[parseInt(hour)] /= timeOfDayCounts[parseInt(hour)];
    }

    const analysis: DwellTimeAnalysis = {
      averageDwellTime,
      dwellTimeDistribution: distribution,
      contentTypePreferences,
      timeOfDayPatterns,
      confidence: Math.min(dwellTimeSignals.length / 100, 1) // Higher confidence with more data
    };

    // Cache result
    this.dwellTimeCache.set(userId, analysis);
    return analysis;
  }

  /**
   * Analyze scroll patterns for user
   */
  public async analyzeScrollPatterns(userId: string): Promise<ScrollPatternAnalysis> {
    // Check cache first
    const cached = this.scrollPatternCache.get(userId);
    if (cached) return cached;

    const signals = this.userSignals.get(userId) || [];
    const scrollSignals = signals.filter(s => s.scrollDepth !== undefined);

    if (scrollSignals.length < 10) {
      return this.createDefaultScrollAnalysis();
    }

    // Calculate average scroll depth
    const totalScrollDepth = scrollSignals.reduce((sum, s) => sum + (s.scrollDepth || 0), 0);
    const averageScrollDepth = totalScrollDepth / scrollSignals.length;

    // Calculate scroll velocity
    const velocitySignals = scrollSignals.filter(s => s.scrollVelocity !== undefined);
    const averageVelocity = velocitySignals.length > 0 
      ? velocitySignals.reduce((sum, s) => sum + (s.scrollVelocity || 0), 0) / velocitySignals.length
      : 100; // Default velocity

    // Determine scroll behavior
    const scrollBehavior = this.determineScrollBehavior(averageScrollDepth, averageVelocity, scrollSignals);

    // Find pause points (where user frequently stops scrolling)
    const pausePoints = this.findPausePoints(scrollSignals);

    // Calculate backtrack frequency
    const backtrackFrequency = this.calculateBacktrackFrequency(scrollSignals);

    const analysis: ScrollPatternAnalysis = {
      averageScrollDepth,
      scrollVelocity: averageVelocity,
      scrollBehavior,
      pausePoints,
      backtrackFrequency,
      confidence: Math.min(scrollSignals.length / 50, 1)
    };

    // Cache result
    this.scrollPatternCache.set(userId, analysis);
    return analysis;
  }

  /**
   * Analyze engagement sequences for user
   */
  public async analyzeEngagementSequences(userId: string): Promise<EngagementSequenceAnalysis> {
    // Check cache first
    const cached = this.engagementCache.get(userId);
    if (cached) return cached;

    const signals = this.userSignals.get(userId) || [];
    
    if (signals.length < 20) {
      return this.createDefaultEngagementAnalysis();
    }

    // Group signals by session
    const sessions = this.groupSignalsBySession(signals);
    
    // Find common sequences
    const commonSequences = this.findCommonSequences(sessions);
    
    // Determine engagement depth
    const engagementDepth = this.determineEngagementDepth(signals);
    
    // Calculate session patterns
    const sessionPatterns = this.calculateSessionPatterns(sessions);

    const analysis: EngagementSequenceAnalysis = {
      commonSequences,
      engagementDepth,
      sessionPatterns,
      confidence: Math.min(signals.length / 100, 1)
    };

    // Cache result
    this.engagementCache.set(userId, analysis);
    return analysis;
  }

  /**
   * Analyze temporal behavior patterns for user
   */
  public async analyzeTemporalBehavior(userId: string): Promise<TemporalBehaviorAnalysis> {
    // Check cache first
    const cached = this.temporalCache.get(userId);
    if (cached) return cached;

    const signals = this.userSignals.get(userId) || [];
    
    if (signals.length < 30) {
      return this.createDefaultTemporalAnalysis();
    }

    // Analyze active hours
    const hourCounts: Record<number, number> = {};
    for (const signal of signals) {
      const hour = signal.timestamp.getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    }

    // Find most active hours (top 25%)
    const sortedHours = Object.entries(hourCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 6) // Top 6 hours
      .map(([hour]) => parseInt(hour));

    // Analyze day of week patterns
    const dayOfWeekPatterns: Record<string, number> = {};
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    for (const signal of signals) {
      const day = days[signal.timestamp.getDay()];
      dayOfWeekPatterns[day] = (dayOfWeekPatterns[day] || 0) + 1;
    }

    // Normalize day patterns
    const totalSignals = signals.length;
    for (const day in dayOfWeekPatterns) {
      dayOfWeekPatterns[day] /= totalSignals;
    }

    // Analyze seasonal patterns (simplified)
    const seasonalPatterns = this.analyzeSeasonalPatterns(signals);
    
    // Determine activity rhythm
    const activityRhythm = this.determineActivityRhythm(sortedHours);
    
    // Calculate consistency score
    const consistencyScore = this.calculateConsistencyScore(hourCounts, dayOfWeekPatterns);

    const analysis: TemporalBehaviorAnalysis = {
      activeHours: sortedHours,
      dayOfWeekPatterns,
      seasonalPatterns,
      activityRhythm,
      consistencyScore,
      confidence: Math.min(signals.length / 200, 1)
    };

    // Cache result
    this.temporalCache.set(userId, analysis);
    return analysis;
  }

  /**
   * Get comprehensive behavior profile for user
   */
  public async getUserBehaviorProfile(userId: string): Promise<{
    dwellTime: DwellTimeAnalysis;
    scrollPattern: ScrollPatternAnalysis;
    engagement: EngagementSequenceAnalysis;
    temporal: TemporalBehaviorAnalysis;
    overallConfidence: number;
  }> {
    const [dwellTime, scrollPattern, engagement, temporal] = await Promise.all([
      this.analyzeDwellTimePatterns(userId),
      this.analyzeScrollPatterns(userId),
      this.analyzeEngagementSequences(userId),
      this.analyzeTemporalBehavior(userId)
    ]);

    const overallConfidence = (dwellTime.confidence + scrollPattern.confidence + 
                              engagement.confidence + temporal.confidence) / 4;

    return {
      dwellTime,
      scrollPattern,
      engagement,
      temporal,
      overallConfidence
    };
  }

  // Helper methods

  private determineScrollBehavior(
    avgDepth: number, 
    avgVelocity: number, 
    signals: BehaviorSignal[]
  ): 'scanner' | 'reader' | 'browser' | 'searcher' {
    if (avgDepth < 0.3 && avgVelocity > 200) return 'scanner'; // Quick, shallow scrolling
    if (avgDepth > 0.7 && avgVelocity < 100) return 'reader'; // Deep, slow scrolling
    if (avgDepth > 0.5 && avgVelocity > 150) return 'browser'; // Moderate depth, fast scrolling
    return 'searcher'; // Looking for specific content
  }

  private findPausePoints(signals: BehaviorSignal[]): number[] {
    const depthCounts: Record<string, number> = {};
    
    for (const signal of signals) {
      const depth = Math.round((signal.scrollDepth || 0) * 10) / 10; // Round to 1 decimal
      depthCounts[depth.toString()] = (depthCounts[depth.toString()] || 0) + 1;
    }

    // Find depths where user pauses frequently
    const threshold = signals.length * 0.05; // 5% of signals
    return Object.entries(depthCounts)
      .filter(([, count]) => count > threshold)
      .map(([depth]) => parseFloat(depth))
      .sort((a, b) => a - b);
  }

  private calculateBacktrackFrequency(signals: BehaviorSignal[]): number {
    let backtracks = 0;
    let lastDepth = 0;
    
    for (const signal of signals) {
      const currentDepth = signal.scrollDepth || 0;
      if (currentDepth < lastDepth - 0.1) { // Significant upward scroll
        backtracks++;
      }
      lastDepth = currentDepth;
    }
    
    return signals.length > 0 ? backtracks / signals.length : 0;
  }

  private groupSignalsBySession(signals: BehaviorSignal[]): BehaviorSignal[][] {
    const sessions: BehaviorSignal[][] = [];
    let currentSession: BehaviorSignal[] = [];
    let lastTimestamp = 0;
    
    for (const signal of signals.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())) {
      const timeDiff = signal.timestamp.getTime() - lastTimestamp;
      
      // New session if more than 30 minutes gap
      if (timeDiff > 30 * 60 * 1000 && currentSession.length > 0) {
        sessions.push(currentSession);
        currentSession = [];
      }
      
      currentSession.push(signal);
      lastTimestamp = signal.timestamp.getTime();
    }
    
    if (currentSession.length > 0) {
      sessions.push(currentSession);
    }
    
    return sessions;
  }

  private findCommonSequences(sessions: BehaviorSignal[][]): EngagementSequenceAnalysis['commonSequences'] {
    const sequenceCounts: Record<string, { count: number; totalTime: number }> = {};
    
    for (const session of sessions) {
      if (session.length < 2) continue;
      
      // Extract sequences of 2-4 actions
      for (let len = 2; len <= Math.min(4, session.length); len++) {
        for (let i = 0; i <= session.length - len; i++) {
          const sequence = session.slice(i, i + len);
          const sequenceKey = sequence.map(s => s.signalType).join(' -> ');
          const timespan = sequence[sequence.length - 1].timestamp.getTime() - sequence[0].timestamp.getTime();
          
          if (!sequenceCounts[sequenceKey]) {
            sequenceCounts[sequenceKey] = { count: 0, totalTime: 0 };
          }
          sequenceCounts[sequenceKey].count++;
          sequenceCounts[sequenceKey].totalTime += timespan;
        }
      }
    }
    
    // Return top 10 most common sequences
    return Object.entries(sequenceCounts)
      .map(([sequence, data]) => ({
        sequence: sequence.split(' -> '),
        frequency: data.count,
        avgTimespan: data.totalTime / data.count
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);
  }

  private determineEngagementDepth(signals: BehaviorSignal[]): 'shallow' | 'moderate' | 'deep' {
    const engagementSignals = signals.filter(s => 
      ['note_reaction', 'note_reply', 'note_renote', 'note_share'].includes(s.signalType)
    );
    
    const engagementRate = engagementSignals.length / signals.length;
    
    if (engagementRate > 0.3) return 'deep';
    if (engagementRate > 0.1) return 'moderate';
    return 'shallow';
  }

  private calculateSessionPatterns(sessions: BehaviorSignal[][]): EngagementSequenceAnalysis['sessionPatterns'] {
    if (sessions.length === 0) {
      return {
        avgSessionLength: 0,
        actionsPerSession: 0,
        peakActivityHours: []
      };
    }
    
    const sessionLengths = sessions.map(session => {
      if (session.length < 2) return 0;
      return session[session.length - 1].timestamp.getTime() - session[0].timestamp.getTime();
    });
    
    const avgSessionLength = sessionLengths.reduce((sum, len) => sum + len, 0) / sessionLengths.length;
    const actionsPerSession = sessions.reduce((sum, session) => sum + session.length, 0) / sessions.length;
    
    // Find peak activity hours
    const hourCounts: Record<number, number> = {};
    for (const session of sessions) {
      for (const signal of session) {
        const hour = signal.timestamp.getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }
    }
    
    const peakActivityHours = Object.entries(hourCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));
    
    return {
      avgSessionLength,
      actionsPerSession,
      peakActivityHours
    };
  }

  private analyzeSeasonalPatterns(signals: BehaviorSignal[]): Record<string, number> {
    const seasonCounts = { spring: 0, summer: 0, fall: 0, winter: 0 };
    
    for (const signal of signals) {
      const month = signal.timestamp.getMonth();
      if (month >= 2 && month <= 4) seasonCounts.spring++;
      else if (month >= 5 && month <= 7) seasonCounts.summer++;
      else if (month >= 8 && month <= 10) seasonCounts.fall++;
      else seasonCounts.winter++;
    }
    
    const total = signals.length;
    for (const season in seasonCounts) {
      seasonCounts[season as keyof typeof seasonCounts] /= total;
    }
    
    return seasonCounts;
  }

  private determineActivityRhythm(activeHours: number[]): 'morning' | 'afternoon' | 'evening' | 'night' | 'irregular' {
    const morningHours = activeHours.filter(h => h >= 6 && h < 12).length;
    const afternoonHours = activeHours.filter(h => h >= 12 && h < 18).length;
    const eveningHours = activeHours.filter(h => h >= 18 && h < 22).length;
    const nightHours = activeHours.filter(h => h >= 22 || h < 6).length;
    
    const max = Math.max(morningHours, afternoonHours, eveningHours, nightHours);
    
    if (max < 2) return 'irregular';
    if (morningHours === max) return 'morning';
    if (afternoonHours === max) return 'afternoon';
    if (eveningHours === max) return 'evening';
    return 'night';
  }

  private calculateConsistencyScore(
    hourCounts: Record<number, number>, 
    dayPatterns: Record<string, number>
  ): number {
    // Calculate variance in hour patterns
    const hourValues = Object.values(hourCounts);
    const hourMean = hourValues.reduce((sum, val) => sum + val, 0) / hourValues.length;
    const hourVariance = hourValues.reduce((sum, val) => sum + Math.pow(val - hourMean, 2), 0) / hourValues.length;
    
    // Calculate variance in day patterns
    const dayValues = Object.values(dayPatterns);
    const dayMean = dayValues.reduce((sum, val) => sum + val, 0) / dayValues.length;
    const dayVariance = dayValues.reduce((sum, val) => sum + Math.pow(val - dayMean, 2), 0) / dayValues.length;
    
    // Lower variance = higher consistency
    const hourConsistency = 1 / (1 + hourVariance);
    const dayConsistency = 1 / (1 + dayVariance);
    
    return (hourConsistency + dayConsistency) / 2;
  }

  // Default analysis creators
  private createDefaultDwellTimeAnalysis(): DwellTimeAnalysis {
    return {
      averageDwellTime: 3000,
      dwellTimeDistribution: { quick: 0.3, brief: 0.4, engaged: 0.2, deep: 0.1 },
      contentTypePreferences: { text: 3000, image: 2000, video: 5000, poll: 2500 },
      timeOfDayPatterns: {},
      confidence: 0.1
    };
  }

  private createDefaultScrollAnalysis(): ScrollPatternAnalysis {
    return {
      averageScrollDepth: 0.5,
      scrollVelocity: 100,
      scrollBehavior: 'browser',
      pausePoints: [0.2, 0.5, 0.8],
      backtrackFrequency: 0.1,
      confidence: 0.1
    };
  }

  private createDefaultEngagementAnalysis(): EngagementSequenceAnalysis {
    return {
      commonSequences: [],
      engagementDepth: 'moderate',
      sessionPatterns: {
        avgSessionLength: 300000, // 5 minutes
        actionsPerSession: 10,
        peakActivityHours: [12, 18, 20]
      },
      confidence: 0.1
    };
  }

  private createDefaultTemporalAnalysis(): TemporalBehaviorAnalysis {
    return {
      activeHours: [9, 12, 15, 18, 20, 21],
      dayOfWeekPatterns: {
        Monday: 0.14, Tuesday: 0.14, Wednesday: 0.14, Thursday: 0.14,
        Friday: 0.15, Saturday: 0.15, Sunday: 0.14
      },
      seasonalPatterns: { spring: 0.25, summer: 0.25, fall: 0.25, winter: 0.25 },
      activityRhythm: 'irregular',
      consistencyScore: 0.5,
      confidence: 0.1
    };
  }

  private invalidateUserCaches(userId: string): void {
    this.dwellTimeCache.delete(userId);
    this.scrollPatternCache.delete(userId);
    this.engagementCache.delete(userId);
    this.temporalCache.delete(userId);
  }

  private startCacheCleanup(): void {
    setInterval(() => {
      // Clean up old signals (keep only last 7 days)
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      
      for (const [userId, signals] of this.userSignals.entries()) {
        const recentSignals = signals.filter(s => s.timestamp.getTime() > cutoff);
        if (recentSignals.length !== signals.length) {
          this.userSignals.set(userId, recentSignals);
          this.invalidateUserCaches(userId);
        }
      }
      
      logger.debug(`Behavioral pattern cache cleanup completed`);
    }, 60 * 60 * 1000); // Every hour
  }

  /**
   * Get service statistics
   */
  public getStats(): {
    totalUsers: number;
    totalSignals: number;
    cacheHitRates: Record<string, number>;
    averageConfidence: number;
  } {
    const totalUsers = this.userSignals.size;
    const totalSignals = Array.from(this.userSignals.values())
      .reduce((sum, signals) => sum + signals.length, 0);
    
    return {
      totalUsers,
      totalSignals,
      cacheHitRates: {
        dwellTime: this.dwellTimeCache.size / Math.max(totalUsers, 1),
        scrollPattern: this.scrollPatternCache.size / Math.max(totalUsers, 1),
        engagement: this.engagementCache.size / Math.max(totalUsers, 1),
        temporal: this.temporalCache.size / Math.max(totalUsers, 1)
      },
      averageConfidence: 0.7 // Estimated
    };
  }
}

// Export singleton instance
export const behavioralPatternRecognition = BehavioralPatternRecognition.getInstance();