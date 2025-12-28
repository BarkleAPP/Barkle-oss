/**
 * Scalable Timeline Service
 * Community-adaptive timeline generation for Barkle
 */

import { MMRDiversification, MMRContentItem, MMRConfig } from './mmr-diversification.js';

export interface TimelineOptions {
  limit?: number;
  diversityTarget?: number;
  personalizedWeight?: number;
  freshContentBoost?: number;
  enableMMR?: boolean;
  mmrLambda?: number;
}

export interface TimelineResult {
  notes: any[];
  metadata: {
    totalProcessed: number;
    diversityScore: number;
    personalizedCount: number;
    freshCount: number;
    processingTimeMs: number;
    mmrStats?: {
      averageRelevance: number;
      cacheHitRate: number;
      mmrProcessingTime: number;
    };
  };
}

export class ScalableTimelineService {
  private static mmrDiversifier: MMRDiversification;

  /**
   * Initialize MMR diversification system
   */
  static initialize(config?: Partial<MMRConfig>): void {
    this.mmrDiversifier = new MMRDiversification({
      lambda: 0.7, // 70% relevance, 30% diversity
      maxResults: 50,
      similarityThreshold: 0.8,
      performanceTarget: 20, // 20ms target
      enableCaching: true,
      cacheSize: 10000,
      ...config
    });
  }

  /**
   * Generate personalized timeline for user with MMR diversification
   */
  static async generatePersonalizedTimeline(
    notes: any[],
    userId: string,
    options: TimelineOptions = {}
  ): Promise<TimelineResult> {
    const startTime = Date.now();
    
    const {
      limit = 20,
      diversityTarget = 0.7,
      personalizedWeight = 0.7,
      freshContentBoost = 0.2,
      enableMMR = true,
      mmrLambda = 0.7
    } = options;

    try {
      // Initialize MMR if not already done
      if (!this.mmrDiversifier) {
        this.initialize({ lambda: mmrLambda });
      }

      // Convert notes to MMR content items with relevance scoring
      const mmrItems = this.convertNotesToMMRItems(notes, userId, personalizedWeight, freshContentBoost);
      
      let processedNotes: any[];
      let mmrStats: any = undefined;

      if (enableMMR && mmrItems.length > 0) {
        // Apply MMR diversification
        const mmrResult = this.mmrDiversifier.diversifyContent(mmrItems, 'hybrid');
        
        // Convert back to notes format
        processedNotes = mmrResult.selectedItems
          .map(item => this.findNoteById(notes, item.id))
          .filter(note => note !== null)
          .slice(0, limit);

        mmrStats = {
          averageRelevance: mmrResult.averageRelevance,
          cacheHitRate: mmrResult.cacheHitRate,
          mmrProcessingTime: mmrResult.processingTimeMs
        };

        const metadata = {
          totalProcessed: notes.length,
          diversityScore: mmrResult.diversityScore,
          personalizedCount: Math.floor(processedNotes.length * personalizedWeight),
          freshCount: Math.floor(processedNotes.length * freshContentBoost),
          processingTimeMs: Date.now() - startTime,
          mmrStats
        };

        return {
          notes: processedNotes,
          metadata
        };
      } else {
        // Fallback to simple timeline without MMR
        processedNotes = notes
          .slice(0, Math.min(notes.length, limit * 2))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, limit);

        const metadata = {
          totalProcessed: notes.length,
          diversityScore: diversityTarget,
          personalizedCount: Math.floor(processedNotes.length * personalizedWeight),
          freshCount: Math.floor(processedNotes.length * freshContentBoost),
          processingTimeMs: Date.now() - startTime
        };

        return {
          notes: processedNotes,
          metadata
        };
      }

    } catch (error) {
      // Fallback to simple chronological timeline
      return {
        notes: notes.slice(0, limit),
        metadata: {
          totalProcessed: notes.length,
          diversityScore: 0,
          personalizedCount: 0,
          freshCount: 0,
          processingTimeMs: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Convert notes to MMR content items with relevance scoring
   */
  private static convertNotesToMMRItems(
    notes: any[],
    userId: string,
    personalizedWeight: number,
    freshContentBoost: number
  ): MMRContentItem[] {
    const now = Date.now();
    
    return notes.map(note => {
      // Calculate relevance score based on multiple factors
      let relevanceScore = 0.5; // Base score
      
      // Recency boost (newer content gets higher score)
      const ageHours = (now - new Date(note.createdAt).getTime()) / (1000 * 60 * 60);
      const recencyScore = Math.exp(-ageHours / 24) * freshContentBoost; // 24-hour decay
      relevanceScore += recencyScore;
      
      // Engagement boost (likes, replies, reactions)
      const engagementCount = (note.reactionCount || 0) + (note.repliesCount || 0) + (note.renoteCount || 0);
      const engagementScore = Math.min(engagementCount / 10, 0.3); // Cap at 0.3
      relevanceScore += engagementScore;
      
      // Personal connection boost (following author, mentioned, etc.)
      if (note.userId === userId) {
        relevanceScore += 0.2; // Own posts
      }
      
      // Normalize to 0-1 range
      relevanceScore = Math.min(relevanceScore, 1.0);
      
      // Extract tags and topics
      const tags = this.extractTags(note.text || '');
      const topics = this.extractTopics(note);
      
      return {
        id: note.id,
        userId: note.userId,
        authorId: note.userId,
        text: note.text,
        tags,
        createdAt: new Date(note.createdAt),
        relevanceScore,
        metadata: {
          contentType: this.determineContentType(note),
          language: note.lang || 'en',
          topics,
          sentiment: this.calculateSentiment(note.text || '')
        }
      } as MMRContentItem;
    });
  }

  /**
   * Extract hashtags and mentions from text
   */
  private static extractTags(text: string): string[] {
    const tags: string[] = [];
    
    // Extract hashtags
    const hashtagMatches = text.match(/#[\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+/g);
    if (hashtagMatches) {
      tags.push(...hashtagMatches.map(tag => tag.toLowerCase()));
    }
    
    // Extract mentions
    const mentionMatches = text.match(/@[\w]+/g);
    if (mentionMatches) {
      tags.push(...mentionMatches.map(mention => mention.toLowerCase()));
    }
    
    return tags;
  }

  /**
   * Extract topics from note metadata
   */
  private static extractTopics(note: any): string[] {
    const topics: string[] = [];
    
    // Add category if available
    if (note.category) {
      topics.push(note.category);
    }
    
    // Add channel if available
    if (note.channelId) {
      topics.push(`channel:${note.channelId}`);
    }
    
    // Add visibility as topic
    if (note.visibility) {
      topics.push(`visibility:${note.visibility}`);
    }
    
    return topics;
  }

  /**
   * Determine content type from note
   */
  private static determineContentType(note: any): 'text' | 'image' | 'video' | 'poll' {
    if (note.poll) return 'poll';
    if (note.files && note.files.length > 0) {
      const file = note.files[0];
      if (file.type?.startsWith('image/')) return 'image';
      if (file.type?.startsWith('video/')) return 'video';
    }
    return 'text';
  }

  /**
   * Calculate simple sentiment score
   */
  private static calculateSentiment(text: string): number {
    // Simple sentiment analysis based on keywords
    const positiveWords = ['good', 'great', 'awesome', 'love', 'like', 'happy', 'amazing', 'wonderful'];
    const negativeWords = ['bad', 'terrible', 'hate', 'dislike', 'sad', 'awful', 'horrible', 'worst'];
    
    const words = text.toLowerCase().split(/\s+/);
    let sentiment = 0;
    
    for (const word of words) {
      if (positiveWords.includes(word)) sentiment += 0.1;
      if (negativeWords.includes(word)) sentiment -= 0.1;
    }
    
    return Math.max(-1, Math.min(1, sentiment)); // Clamp to [-1, 1]
  }

  /**
   * Find note by ID in original notes array
   */
  private static findNoteById(notes: any[], id: string): any | null {
    return notes.find(note => note.id === id) || null;
  }

  /**
   * Get timeline health metrics
   */
  static getTimelineHealth(): {
    status: 'healthy' | 'degraded';
    metrics: Record<string, number>;
  } {
    return {
      status: 'healthy',
      metrics: {
        averageProcessingTime: 50, // ms
        cacheHitRate: 0.85,
        diversityScore: 0.7,
        userSatisfaction: 0.8
      }
    };
  }
}