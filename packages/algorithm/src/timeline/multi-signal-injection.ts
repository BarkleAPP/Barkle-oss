/**
 * Multi-Signal Diversity Injection
 * Implements trending, fresh, cross-topic, and serendipity content injection
 */

import type { MMRContentItem } from './mmr-diversification.js';

/**
 * Injection signal types
 */
export type InjectionSignal = 'trending' | 'fresh' | 'cross_topic' | 'serendipity' | 'quality_boost' | 'community_highlight';

/**
 * Injection strategy configuration
 */
export interface InjectionStrategy {
  signal: InjectionSignal;
  weight: number; // Relative importance (0-1)
  frequency: number; // Inject every N items
  maxInjections: number; // Maximum injections per timeline
  enabled: boolean;
  communityAdaptive: boolean; // Adapt based on community size
}

/**
 * Content injection context
 */
export interface InjectionContext {
  userId: string;
  userPreferences?: {
    topics: string[];
    authors: string[];
    contentTypes: string[];
    engagementHistory: Record<string, number>;
  };
  communitySize: number;
  timelineLength: number;
  existingTopics: Set<string>;
  existingAuthors: Set<string>;
  currentTime: Date;
}

/**
 * Injection result
 */
export interface InjectionResult {
  injectedItems: MMRContentItem[];
  injectionsBySignal: Record<InjectionSignal, number>;
  diversityImprovement: number;
  qualityScore: number;
  processingTimeMs: number;
  metadata: {
    totalCandidates: number;
    signalsProcessed: InjectionSignal[];
    communityAdaptations: string[];
  };
}

/**
 * Trending content detector
 */
interface TrendingMetrics {
  engagementVelocity: number; // Engagement per hour
  viralityScore: number; // Spread rate across users
  recencyBoost: number; // Boost for recent content
  qualityScore: number; // Content quality assessment
}

/**
 * Multi-Signal Diversity Injection System
 * Injects diverse content based on multiple signals and community adaptation
 */
export class MultiSignalInjection {
  private strategies: Map<InjectionSignal, InjectionStrategy>;
  private injectionHistory: Map<string, number> = new Map(); // Track user injection history
  private trendingCache: Map<string, TrendingMetrics> = new Map();
  private qualityCache: Map<string, number> = new Map();
  
  constructor(strategies?: Partial<Record<InjectionSignal, Partial<InjectionStrategy>>>) {
    this.strategies = new Map();
    
    // Initialize default strategies
    const defaultStrategies: Record<InjectionSignal, InjectionStrategy> = {
      trending: {
        signal: 'trending',
        weight: 0.3,
        frequency: 5,
        maxInjections: 4,
        enabled: true,
        communityAdaptive: true
      },
      fresh: {
        signal: 'fresh',
        weight: 0.25,
        frequency: 7,
        maxInjections: 3,
        enabled: true,
        communityAdaptive: true
      },
      cross_topic: {
        signal: 'cross_topic',
        weight: 0.2,
        frequency: 10,
        maxInjections: 2,
        enabled: true,
        communityAdaptive: false
      },
      serendipity: {
        signal: 'serendipity',
        weight: 0.15,
        frequency: 15,
        maxInjections: 2,
        enabled: true,
        communityAdaptive: true
      },
      quality_boost: {
        signal: 'quality_boost',
        weight: 0.1,
        frequency: 12,
        maxInjections: 1,
        enabled: true,
        communityAdaptive: false
      },
      community_highlight: {
        signal: 'community_highlight',
        weight: 0.1,
        frequency: 20,
        maxInjections: 1,
        enabled: true,
        communityAdaptive: true
      }
    };
    
    // Apply custom strategies
    for (const [signal, strategy] of Object.entries(defaultStrategies)) {
      const customStrategy = strategies?.[signal as InjectionSignal];
      this.strategies.set(signal as InjectionSignal, {
        ...strategy,
        ...customStrategy
      });
    }
  }
  
  /**
   * Inject diverse content into timeline using multiple signals
   */
  public injectDiverseContent(
    personalizedContent: MMRContentItem[],
    candidatePool: MMRContentItem[],
    context: InjectionContext
  ): InjectionResult {
    const startTime = Date.now();
    const injectedItems: MMRContentItem[] = [];
    const injectionsBySignal: Record<InjectionSignal, number> = {} as any;
    const communityAdaptations: string[] = [];
    
    // Initialize injection counters
    for (const signal of this.strategies.keys()) {
      injectionsBySignal[signal] = 0;
    }
    
    // Adapt strategies based on community size
    this.adaptStrategiesForCommunity(context, communityAdaptations);
    
    // Process each injection signal
    const signalsProcessed: InjectionSignal[] = [];
    
    for (const [signal, strategy] of this.strategies.entries()) {
      if (!strategy.enabled) continue;
      
      signalsProcessed.push(signal);
      
      const candidates = this.getCandidatesForSignal(
        signal,
        candidatePool,
        personalizedContent,
        context
      );
      
      const injections = this.performSignalInjection(
        signal,
        candidates,
        strategy,
        context
      );
      
      injectedItems.push(...injections);
      injectionsBySignal[signal] = injections.length;
    }
    
    // Calculate metrics
    const diversityImprovement = this.calculateDiversityImprovement(
      personalizedContent,
      injectedItems,
      context
    );
    
    const qualityScore = this.calculateQualityScore(injectedItems);
    
    const processingTime = Date.now() - startTime;
    
    return {
      injectedItems,
      injectionsBySignal,
      diversityImprovement,
      qualityScore,
      processingTimeMs: processingTime,
      metadata: {
        totalCandidates: candidatePool.length,
        signalsProcessed,
        communityAdaptations
      }
    };
  }
  
  /**
   * Adapt injection strategies based on community size
   */
  private adaptStrategiesForCommunity(
    context: InjectionContext,
    adaptations: string[]
  ): void {
    const { communitySize } = context;
    
    for (const [signal, strategy] of this.strategies.entries()) {
      if (!strategy.communityAdaptive) continue;
      
      const originalWeight = strategy.weight;
      const originalFrequency = strategy.frequency;
      
      if (communitySize < 1000) {
        // Small community: more serendipity, less trending
        if (signal === 'serendipity') {
          strategy.weight *= 1.5;
          strategy.frequency = Math.max(strategy.frequency - 3, 5);
          adaptations.push(`Increased ${signal} for small community`);
        } else if (signal === 'trending') {
          strategy.weight *= 0.7;
          strategy.frequency += 3;
          adaptations.push(`Reduced ${signal} for small community`);
        }
      } else if (communitySize > 50000) {
        // Large community: more trending, structured discovery
        if (signal === 'trending') {
          strategy.weight *= 1.3;
          strategy.frequency = Math.max(strategy.frequency - 2, 3);
          adaptations.push(`Increased ${signal} for large community`);
        } else if (signal === 'fresh') {
          strategy.weight *= 1.2;
          adaptations.push(`Boosted ${signal} for large community`);
        }
      }
      
      // Log significant changes
      if (Math.abs(strategy.weight - originalWeight) > 0.05 ||
          Math.abs(strategy.frequency - originalFrequency) > 2) {
        adaptations.push(`Adapted ${signal}: weight ${originalWeight.toFixed(2)} → ${strategy.weight.toFixed(2)}`);
      }
    }
  }
  
  /**
   * Get candidates for specific injection signal
   */
  private getCandidatesForSignal(
    signal: InjectionSignal,
    candidatePool: MMRContentItem[],
    personalizedContent: MMRContentItem[],
    context: InjectionContext
  ): MMRContentItem[] {
    const existingIds = new Set(personalizedContent.map(item => item.id));
    const availableCandidates = candidatePool.filter(item => !existingIds.has(item.id));
    
    switch (signal) {
      case 'trending':
        return this.getTrendingCandidates(availableCandidates, context);
      
      case 'fresh':
        return this.getFreshCandidates(availableCandidates, context);
      
      case 'cross_topic':
        return this.getCrossTopicCandidates(availableCandidates, context);
      
      case 'serendipity':
        return this.getSerendipityCandidates(availableCandidates, context);
      
      case 'quality_boost':
        return this.getQualityBoostCandidates(availableCandidates, context);
      
      case 'community_highlight':
        return this.getCommunityHighlightCandidates(availableCandidates, context);
      
      default:
        return [];
    }
  }
  
  /**
   * Get trending content candidates
   */
  private getTrendingCandidates(candidates: MMRContentItem[], context: InjectionContext): MMRContentItem[] {
    return candidates
      .map(item => ({
        ...item,
        trendingScore: this.calculateTrendingScore(item, context)
      }))
      .filter(item => item.trendingScore > 0.3)
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, 20);
  }
  
  /**
   * Calculate trending score for content
   */
  private calculateTrendingScore(item: MMRContentItem, context: InjectionContext): number {
    const cacheKey = `trending-${item.id}`;
    
    if (this.trendingCache.has(cacheKey)) {
      const cached = this.trendingCache.get(cacheKey)!;
      return cached.engagementVelocity * 0.4 + cached.viralityScore * 0.3 + 
             cached.recencyBoost * 0.2 + cached.qualityScore * 0.1;
    }
    
    // Calculate trending metrics
    const ageHours = (context.currentTime.getTime() - item.createdAt.getTime()) / (1000 * 60 * 60);
    const recencyBoost = Math.exp(-ageHours / 6); // 6-hour peak window
    
    // Simulate engagement velocity (would come from real metrics)
    const engagementVelocity = item.relevanceScore * recencyBoost;
    
    // Simulate virality (would track actual spread)
    const viralityScore = Math.min(item.relevanceScore * 1.5, 1);
    
    // Quality assessment
    const qualityScore = this.assessContentQuality(item);
    
    const metrics: TrendingMetrics = {
      engagementVelocity,
      viralityScore,
      recencyBoost,
      qualityScore
    };
    
    this.trendingCache.set(cacheKey, metrics);
    
    return engagementVelocity * 0.4 + viralityScore * 0.3 + recencyBoost * 0.2 + qualityScore * 0.1;
  }
  
  /**
   * Get fresh content candidates
   */
  private getFreshCandidates(candidates: MMRContentItem[], context: InjectionContext): MMRContentItem[] {
    const cutoffTime = new Date(context.currentTime.getTime() - 2 * 60 * 60 * 1000); // 2 hours
    
    return candidates
      .filter(item => item.createdAt > cutoffTime)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 15);
  }
  
  /**
   * Get cross-topic content candidates
   */
  private getCrossTopicCandidates(candidates: MMRContentItem[], context: InjectionContext): MMRContentItem[] {
    const userTopics = new Set(context.userPreferences?.topics || []);
    const existingTopics = context.existingTopics;
    
    return candidates
      .filter(item => {
        const itemTopics = new Set([...(item.tags || []), ...(item.metadata?.topics || [])]);
        
        // Must have topics not in user preferences or existing timeline
        const hasNewTopics = [...itemTopics].some(topic => 
          !userTopics.has(topic) && !existingTopics.has(topic)
        );
        
        return hasNewTopics && itemTopics.size > 0;
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 10);
  }
  
  /**
   * Get serendipity content candidates
   */
  private getSerendipityCandidates(candidates: MMRContentItem[], context: InjectionContext): MMRContentItem[] {
    const userAuthors = new Set(context.userPreferences?.authors || []);
    const existingAuthors = context.existingAuthors;
    
    // Random selection with quality filter
    const unexploredCandidates = candidates
      .filter(item => 
        !userAuthors.has(item.authorId) && 
        !existingAuthors.has(item.authorId) &&
        item.relevanceScore > 0.2 // Minimum quality threshold
      );
    
    // Shuffle and take top candidates
    const shuffled = this.shuffleArray([...unexploredCandidates]);
    return shuffled.slice(0, 8);
  }
  
  /**
   * Get quality boost candidates
   */
  private getQualityBoostCandidates(candidates: MMRContentItem[], context: InjectionContext): MMRContentItem[] {
    return candidates
      .map(item => ({
        ...item,
        qualityScore: this.assessContentQuality(item)
      }))
      .filter(item => item.qualityScore > 0.8)
      .sort((a, b) => b.qualityScore - a.qualityScore)
      .slice(0, 5);
  }
  
  /**
   * Get community highlight candidates
   */
  private getCommunityHighlightCandidates(candidates: MMRContentItem[], context: InjectionContext): MMRContentItem[] {
    // Highlight content from community leaders or high-engagement authors
    return candidates
      .filter(item => {
        // Simulate community leader detection (would use real metrics)
        const authorEngagement = context.userPreferences?.engagementHistory?.[item.authorId] || 0;
        return authorEngagement > 0.7 || item.relevanceScore > 0.8;
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 3);
  }
  
  /**
   * Perform injection for specific signal
   */
  private performSignalInjection(
    signal: InjectionSignal,
    candidates: MMRContentItem[],
    strategy: InjectionStrategy,
    context: InjectionContext
  ): MMRContentItem[] {
    if (candidates.length === 0) return [];
    
    const maxInjections = Math.min(
      strategy.maxInjections,
      Math.floor(context.timelineLength / strategy.frequency)
    );
    
    // Select best candidates based on signal-specific scoring
    const selectedCandidates = candidates.slice(0, maxInjections);
    
    // Add injection metadata
    return selectedCandidates.map(item => ({
      ...item,
      metadata: {
        ...item.metadata,
        contentType: item.metadata?.contentType || 'text',
        injectionSignal: signal,
        injectionWeight: strategy.weight,
        injectionReason: this.getInjectionReason(signal, item)
      } as any
    }));
  }
  
  /**
   * Get human-readable injection reason
   */
  private getInjectionReason(signal: InjectionSignal, item: MMRContentItem): string {
    switch (signal) {
      case 'trending':
        return 'Trending in your community';
      case 'fresh':
        return 'Fresh content';
      case 'cross_topic':
        return 'Discover new topics';
      case 'serendipity':
        return 'Something different';
      case 'quality_boost':
        return 'High-quality content';
      case 'community_highlight':
        return 'Community highlight';
      default:
        return 'Recommended for you';
    }
  }
  
  /**
   * Assess content quality
   */
  private assessContentQuality(item: MMRContentItem): number {
    const cacheKey = `quality-${item.id}`;
    
    if (this.qualityCache.has(cacheKey)) {
      return this.qualityCache.get(cacheKey)!;
    }
    
    let qualityScore = 0.5; // Base score
    
    // Text length (not too short, not too long)
    const textLength = item.text?.length || 0;
    if (textLength > 50 && textLength < 2000) {
      qualityScore += 0.2;
    }
    
    // Has tags/topics
    if ((item.tags?.length || 0) > 0 || (item.metadata?.topics?.length || 0) > 0) {
      qualityScore += 0.1;
    }
    
    // Content type diversity
    if (item.metadata?.contentType && item.metadata.contentType !== 'text') {
      qualityScore += 0.1;
    }
    
    // Relevance score contribution
    qualityScore += item.relevanceScore * 0.2;
    
    // Clamp to [0, 1]
    qualityScore = Math.max(0, Math.min(1, qualityScore));
    
    this.qualityCache.set(cacheKey, qualityScore);
    return qualityScore;
  }
  
  /**
   * Calculate diversity improvement
   */
  private calculateDiversityImprovement(
    originalContent: MMRContentItem[],
    injectedContent: MMRContentItem[],
    context: InjectionContext
  ): number {
    if (injectedContent.length === 0) return 0;
    
    // Author diversity
    const originalAuthors = new Set(originalContent.map(item => item.authorId));
    const newAuthors = new Set(injectedContent.map(item => item.authorId));
    const authorDiversityGain = newAuthors.size / Math.max(originalAuthors.size, 1);
    
    // Topic diversity
    const originalTopics = new Set(originalContent.flatMap(item => item.tags || []));
    const newTopics = new Set(injectedContent.flatMap(item => item.tags || []));
    const topicDiversityGain = newTopics.size / Math.max(originalTopics.size, 1);
    
    // Content type diversity
    const originalTypes = new Set(originalContent.map(item => item.metadata?.contentType || 'text'));
    const newTypes = new Set(injectedContent.map(item => item.metadata?.contentType || 'text'));
    const typeDiversityGain = newTypes.size / Math.max(originalTypes.size, 1);
    
    return (authorDiversityGain * 0.4 + topicDiversityGain * 0.4 + typeDiversityGain * 0.2);
  }
  
  /**
   * Calculate overall quality score
   */
  private calculateQualityScore(items: MMRContentItem[]): number {
    if (items.length === 0) return 0;
    
    const totalQuality = items.reduce((sum, item) => sum + this.assessContentQuality(item), 0);
    return totalQuality / items.length;
  }
  
  /**
   * Utility: Shuffle array
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
  
  /**
   * Update injection strategy
   */
  public updateStrategy(signal: InjectionSignal, updates: Partial<InjectionStrategy>): void {
    const current = this.strategies.get(signal);
    if (current) {
      this.strategies.set(signal, { ...current, ...updates });
    }
  }
  
  /**
   * Get current strategies
   */
  public getStrategies(): Map<InjectionSignal, InjectionStrategy> {
    return new Map(this.strategies);
  }
  
  /**
   * Clear caches
   */
  public clearCaches(): void {
    this.trendingCache.clear();
    this.qualityCache.clear();
    this.injectionHistory.clear();
  }
}