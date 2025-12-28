/**
 * Quality Assessment Pipeline
 * Implements content quality scoring, safety filtering, spam detection, and user feedback integration
 */

import type { MMRContentItem } from './mmr-diversification.js';

/**
 * Quality assessment result
 */
export interface QualityAssessment {
  contentId: string;
  overallScore: number; // 0-1, higher is better
  qualityMetrics: {
    contentQuality: number;
    safetyScore: number;
    spamScore: number; // 0-1, higher means more likely spam
    engagementPrediction: number;
  };
  flags: QualityFlag[];
  recommendations: string[];
  processingTimeMs: number;
  confidence: number; // Confidence in the assessment
}

/**
 * Quality flags for content
 */
export type QualityFlag = 
  | 'high_quality'
  | 'low_quality'
  | 'potentially_unsafe'
  | 'spam_detected'
  | 'duplicate_content'
  | 'low_engagement_predicted'
  | 'controversial'
  | 'needs_review'
  | 'user_reported'
  | 'automated_content';

/**
 * Safety assessment categories
 */
export interface SafetyAssessment {
  isAppropriate: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  categories: {
    harassment: number;
    hateSpeech: number;
    violence: number;
    adultContent: number;
    spam: number;
    misinformation: number;
  };
  confidence: number;
}

/**
 * Spam detection result
 */
export interface SpamDetection {
  isSpam: boolean;
  spamScore: number;
  indicators: {
    repetitiveContent: number;
    suspiciousLinks: number;
    promotionalContent: number;
    lowQualityText: number;
    rapidPosting: number;
    fakeEngagement: number;
  };
  confidence: number;
}

/**
 * User feedback data
 */
export interface UserFeedback {
  contentId: string;
  userId: string;
  feedbackType: 'like' | 'dislike' | 'report' | 'hide' | 'share' | 'save';
  timestamp: Date;
  reason?: string;
  severity?: 'low' | 'medium' | 'high';
}

/**
 * Quality assessment configuration
 */
export interface QualityConfig {
  enableSafetyFilter: boolean;
  enableSpamDetection: boolean;
  enableUserFeedback: boolean;
  safetyThreshold: number; // Minimum safety score (0-1)
  spamThreshold: number; // Maximum spam score (0-1)
  qualityThreshold: number; // Minimum quality score (0-1)
  feedbackWeight: number; // Weight of user feedback (0-1)
  processingTimeout: number; // Max processing time in ms
}

/**
 * Quality Assessment Pipeline
 * Comprehensive content quality evaluation system
 */
export class QualityAssessmentPipeline {
  private config: QualityConfig;
  private feedbackHistory: Map<string, UserFeedback[]> = new Map();
  private contentCache: Map<string, QualityAssessment> = new Map();
  private spamPatterns: RegExp[] = [];
  private safetyKeywords: Map<string, number> = new Map();
  
  constructor(config?: Partial<QualityConfig>) {
    this.config = {
      enableSafetyFilter: true,
      enableSpamDetection: true,
      enableUserFeedback: true,
      safetyThreshold: 0.7,
      spamThreshold: 0.3,
      qualityThreshold: 0.4,
      feedbackWeight: 0.2,
      processingTimeout: 10, // 10ms max
      ...config
    };
    
    this.initializePatterns();
  }
  
  /**
   * Assess content quality with comprehensive pipeline
   */
  public async assessContent(item: MMRContentItem): Promise<QualityAssessment> {
    const startTime = Date.now();
    const contentId = item.id;
    
    // Check cache first
    if (this.contentCache.has(contentId)) {
      const cached = this.contentCache.get(contentId)!;
      return {
        ...cached,
        processingTimeMs: Date.now() - startTime
      };
    }
    
    try {
      // Run parallel assessments
      const [contentQuality, safetyAssessment, spamDetection] = await Promise.all([
        this.assessContentQuality(item),
        this.config.enableSafetyFilter ? this.assessSafety(item) : this.getDefaultSafety(),
        this.config.enableSpamDetection ? this.detectSpam(item) : this.getDefaultSpam()
      ]);
      
      // Integrate user feedback
      const feedbackScore = this.config.enableUserFeedback 
        ? this.calculateFeedbackScore(contentId)
        : 0.5;
      
      // Calculate overall score
      const overallScore = this.calculateOverallScore(
        contentQuality,
        safetyAssessment.isAppropriate ? 1 : 0,
        1 - spamDetection.spamScore,
        feedbackScore
      );
      
      // Generate flags and recommendations
      const flags = this.generateQualityFlags(
        contentQuality,
        safetyAssessment,
        spamDetection,
        feedbackScore
      );
      
      const recommendations = this.generateRecommendations(flags, overallScore);
      
      // Calculate engagement prediction
      const engagementPrediction = this.predictEngagement(item, overallScore);
      
      const assessment: QualityAssessment = {
        contentId,
        overallScore,
        qualityMetrics: {
          contentQuality,
          safetyScore: safetyAssessment.isAppropriate ? 1 : 0,
          spamScore: spamDetection.spamScore,
          engagementPrediction
        },
        flags,
        recommendations,
        processingTimeMs: Date.now() - startTime,
        confidence: this.calculateConfidence(safetyAssessment, spamDetection)
      };
      
      // Cache result
      this.contentCache.set(contentId, assessment);
      
      return assessment;
      
    } catch (error) {
      // Fallback assessment on error
      return this.createFallbackAssessment(contentId, startTime);
    }
  }
  
  /**
   * Assess content quality based on multiple factors
   */
  private async assessContentQuality(item: MMRContentItem): Promise<number> {
    let qualityScore = 0.5; // Base score
    
    // Text quality assessment
    if (item.text) {
      qualityScore += this.assessTextQuality(item.text) * 0.4;
    }
    
    // Metadata quality
    qualityScore += this.assessMetadataQuality(item) * 0.2;
    
    // Author quality (based on historical performance)
    qualityScore += this.assessAuthorQuality(item.authorId) * 0.2;
    
    // Content freshness and relevance
    qualityScore += this.assessFreshnessRelevance(item) * 0.2;
    
    return Math.max(0, Math.min(1, qualityScore));
  }
  
  /**
   * Assess text quality
   */
  private assessTextQuality(text: string): number {
    let score = 0;
    
    // Length assessment (optimal range)
    const length = text.length;
    if (length >= 50 && length <= 2000) {
      score += 0.3;
    } else if (length >= 20 && length <= 5000) {
      score += 0.1;
    }
    
    // Word count and sentence structure
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    if (words.length >= 10 && words.length <= 500) {
      score += 0.2;
    }
    
    if (sentences.length >= 2) {
      score += 0.1;
    }
    
    // Language quality indicators
    const uppercaseRatio = (text.match(/[A-Z]/g) || []).length / text.length;
    if (uppercaseRatio < 0.3) { // Not too much shouting
      score += 0.1;
    }
    
    // Punctuation and grammar indicators
    const hasProperPunctuation = /[.!?]/.test(text);
    if (hasProperPunctuation) {
      score += 0.1;
    }
    
    // Repetition detection
    const repetitionScore = this.detectRepetition(text);
    score += (1 - repetitionScore) * 0.2;
    
    return Math.max(0, Math.min(1, score));
  }
  
  /**
   * Assess metadata quality
   */
  private assessMetadataQuality(item: MMRContentItem): number {
    let score = 0;
    
    // Has tags
    if (item.tags && item.tags.length > 0) {
      score += 0.3;
    }
    
    // Has topics
    if (item.metadata?.topics && item.metadata.topics.length > 0) {
      score += 0.2;
    }
    
    // Content type diversity
    if (item.metadata?.contentType && item.metadata.contentType !== 'text') {
      score += 0.2;
    }
    
    // Language specified
    if (item.metadata?.language) {
      score += 0.1;
    }
    
    // Sentiment analysis available
    if (item.metadata?.sentiment !== undefined) {
      score += 0.1;
      
      // Moderate sentiment is generally better
      const sentimentScore = Math.abs(item.metadata.sentiment);
      if (sentimentScore < 0.8) {
        score += 0.1;
      }
    }
    
    return Math.max(0, Math.min(1, score));
  }
  
  /**
   * Assess author quality based on historical performance
   */
  private assessAuthorQuality(authorId: string): number {
    // Simulate author quality assessment
    // In production, this would use real author metrics
    
    // Hash author ID to get consistent but varied scores
    let hash = 0;
    for (let i = 0; i < authorId.length; i++) {
      hash = ((hash << 5) - hash + authorId.charCodeAt(i)) & 0xffffffff;
    }
    
    // Convert to 0-1 range with bias toward good authors
    const baseScore = (Math.abs(hash) % 1000) / 1000;
    return 0.3 + baseScore * 0.7; // Range: 0.3 to 1.0
  }
  
  /**
   * Assess freshness and relevance
   */
  private assessFreshnessRelevance(item: MMRContentItem): number {
    let score = 0;
    
    // Freshness (newer content gets higher score)
    const ageHours = (Date.now() - item.createdAt.getTime()) / (1000 * 60 * 60);
    const freshnessScore = Math.exp(-ageHours / 24); // 24-hour decay
    score += freshnessScore * 0.5;
    
    // Relevance score contribution
    score += item.relevanceScore * 0.5;
    
    return Math.max(0, Math.min(1, score));
  }
  
  /**
   * Assess content safety
   */
  private async assessSafety(item: MMRContentItem): Promise<SafetyAssessment> {
    const text = item.text || '';
    
    // Simple keyword-based safety assessment
    const categories = {
      harassment: this.detectHarassment(text),
      hateSpeech: this.detectHateSpeech(text),
      violence: this.detectViolence(text),
      adultContent: this.detectAdultContent(text),
      spam: this.detectSpamKeywords(text),
      misinformation: this.detectMisinformation(text)
    };
    
    // Calculate overall risk
    const maxRisk = Math.max(...Object.values(categories));
    const avgRisk = Object.values(categories).reduce((sum, val) => sum + val, 0) / 6;
    
    const riskLevel: 'low' | 'medium' | 'high' = 
      maxRisk > 0.7 ? 'high' : 
      maxRisk > 0.4 ? 'medium' : 'low';
    
    const isAppropriate = maxRisk < this.config.safetyThreshold;
    
    return {
      isAppropriate,
      riskLevel,
      categories,
      confidence: 0.8 // Simple keyword matching has moderate confidence
    };
  }
  
  /**
   * Detect spam content
   */
  private async detectSpam(item: MMRContentItem): Promise<SpamDetection> {
    const text = item.text || '';
    
    const indicators = {
      repetitiveContent: this.detectRepetition(text),
      suspiciousLinks: this.detectSuspiciousLinks(text),
      promotionalContent: this.detectPromotionalContent(text),
      lowQualityText: 1 - this.assessTextQuality(text),
      rapidPosting: this.detectRapidPosting(item.authorId, item.createdAt),
      fakeEngagement: this.detectFakeEngagement(item)
    };
    
    // Weighted spam score
    const spamScore = 
      indicators.repetitiveContent * 0.2 +
      indicators.suspiciousLinks * 0.25 +
      indicators.promotionalContent * 0.2 +
      indicators.lowQualityText * 0.15 +
      indicators.rapidPosting * 0.1 +
      indicators.fakeEngagement * 0.1;
    
    const isSpam = spamScore > this.config.spamThreshold;
    
    return {
      isSpam,
      spamScore,
      indicators,
      confidence: 0.75
    };
  }
  
  /**
   * Calculate feedback score from user interactions
   */
  private calculateFeedbackScore(contentId: string): number {
    const feedback = this.feedbackHistory.get(contentId) || [];
    
    if (feedback.length === 0) {
      return 0.5; // Neutral score for no feedback
    }
    
    let score = 0;
    let totalWeight = 0;
    
    for (const fb of feedback) {
      let weight = 1;
      let value = 0.5;
      
      // Weight by recency (more recent feedback is more important)
      const ageHours = (Date.now() - fb.timestamp.getTime()) / (1000 * 60 * 60);
      weight *= Math.exp(-ageHours / 168); // 1-week decay
      
      // Convert feedback type to score
      switch (fb.feedbackType) {
        case 'like':
        case 'share':
        case 'save':
          value = 0.8;
          break;
        case 'dislike':
          value = 0.2;
          break;
        case 'report':
          value = 0.1;
          weight *= 2; // Reports are more important
          break;
        case 'hide':
          value = 0.3;
          break;
      }
      
      // Adjust by severity
      if (fb.severity === 'high') weight *= 1.5;
      else if (fb.severity === 'low') weight *= 0.7;
      
      score += value * weight;
      totalWeight += weight;
    }
    
    return totalWeight > 0 ? score / totalWeight : 0.5;
  }
  
  /**
   * Calculate overall quality score
   */
  private calculateOverallScore(
    contentQuality: number,
    safetyScore: number,
    antiSpamScore: number,
    feedbackScore: number
  ): number {
    const weights = {
      content: 0.4,
      safety: 0.3,
      spam: 0.2,
      feedback: this.config.feedbackWeight
    };
    
    // Normalize weights
    const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
    
    return (
      contentQuality * weights.content +
      safetyScore * weights.safety +
      antiSpamScore * weights.spam +
      feedbackScore * weights.feedback
    ) / totalWeight;
  }
  
  /**
   * Generate quality flags
   */
  private generateQualityFlags(
    contentQuality: number,
    safetyAssessment: SafetyAssessment,
    spamDetection: SpamDetection,
    feedbackScore: number
  ): QualityFlag[] {
    const flags: QualityFlag[] = [];
    
    // Quality flags
    if (contentQuality > 0.8) {
      flags.push('high_quality');
    } else if (contentQuality < 0.3) {
      flags.push('low_quality');
    }
    
    // Safety flags
    if (!safetyAssessment.isAppropriate) {
      flags.push('potentially_unsafe');
    }
    
    if (safetyAssessment.riskLevel === 'high') {
      flags.push('needs_review');
    }
    
    // Spam flags
    if (spamDetection.isSpam) {
      flags.push('spam_detected');
    }
    
    // Feedback flags
    if (feedbackScore < 0.3) {
      flags.push('user_reported');
    }
    
    // Engagement prediction
    const engagementPrediction = this.predictEngagement({} as any, contentQuality);
    if (engagementPrediction < 0.3) {
      flags.push('low_engagement_predicted');
    }
    
    return flags;
  }
  
  /**
   * Generate recommendations
   */
  private generateRecommendations(flags: QualityFlag[], overallScore: number): string[] {
    const recommendations: string[] = [];
    
    if (flags.includes('low_quality')) {
      recommendations.push('Consider improving content quality');
    }
    
    if (flags.includes('potentially_unsafe')) {
      recommendations.push('Review content for safety concerns');
    }
    
    if (flags.includes('spam_detected')) {
      recommendations.push('Content flagged as potential spam');
    }
    
    if (flags.includes('low_engagement_predicted')) {
      recommendations.push('Low engagement predicted - consider boosting');
    }
    
    if (overallScore > 0.8) {
      recommendations.push('High-quality content - consider promoting');
    }
    
    return recommendations;
  }
  
  /**
   * Predict engagement based on quality metrics
   */
  private predictEngagement(item: MMRContentItem, qualityScore: number): number {
    // Simple engagement prediction model
    let prediction = qualityScore * 0.6;
    
    // Add relevance score contribution
    prediction += (item.relevanceScore || 0.5) * 0.3;
    
    // Add randomness for uncertainty
    prediction += (Math.random() - 0.5) * 0.2;
    
    return Math.max(0, Math.min(1, prediction));
  }
  
  /**
   * Calculate confidence in assessment
   */
  private calculateConfidence(
    safetyAssessment: SafetyAssessment,
    spamDetection: SpamDetection
  ): number {
    return (safetyAssessment.confidence + spamDetection.confidence) / 2;
  }
  
  /**
   * Add user feedback
   */
  public addUserFeedback(feedback: UserFeedback): void {
    const existing = this.feedbackHistory.get(feedback.contentId) || [];
    existing.push(feedback);
    this.feedbackHistory.set(feedback.contentId, existing);
    
    // Invalidate cache for this content
    this.contentCache.delete(feedback.contentId);
  }
  
  /**
   * Batch assess multiple items
   */
  public async batchAssess(items: MMRContentItem[]): Promise<QualityAssessment[]> {
    const assessments = await Promise.all(
      items.map(item => this.assessContent(item))
    );
    
    return assessments;
  }
  
  /**
   * Filter content based on quality thresholds
   */
  public async filterContent(items: MMRContentItem[]): Promise<{
    passed: MMRContentItem[];
    filtered: MMRContentItem[];
    assessments: QualityAssessment[];
  }> {
    const assessments = await this.batchAssess(items);
    const passed: MMRContentItem[] = [];
    const filtered: MMRContentItem[] = [];
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const assessment = assessments[i];
      
      if (this.passesQualityFilter(assessment)) {
        passed.push(item);
      } else {
        filtered.push(item);
      }
    }
    
    return { passed, filtered, assessments };
  }
  
  /**
   * Check if content passes quality filter
   */
  private passesQualityFilter(assessment: QualityAssessment): boolean {
    return (
      assessment.overallScore >= this.config.qualityThreshold &&
      assessment.qualityMetrics.safetyScore >= this.config.safetyThreshold &&
      assessment.qualityMetrics.spamScore <= this.config.spamThreshold &&
      !assessment.flags.includes('spam_detected') &&
      !assessment.flags.includes('potentially_unsafe')
    );
  }
  
  // Helper methods for detection
  private detectRepetition(text: string): number {
    const words = text.toLowerCase().split(/\s+/);
    const wordCount = new Map<string, number>();
    
    for (const word of words) {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    }
    
    const maxCount = Math.max(...wordCount.values());
    return Math.min(maxCount / words.length, 1);
  }
  
  private detectHarassment(text: string): number {
    const harassmentKeywords = ['bully', 'harass', 'threaten', 'intimidate'];
    return this.keywordScore(text, harassmentKeywords);
  }
  
  private detectHateSpeech(text: string): number {
    const hateSpeechKeywords = ['hate', 'racist', 'discriminat'];
    return this.keywordScore(text, hateSpeechKeywords);
  }
  
  private detectViolence(text: string): number {
    const violenceKeywords = ['kill', 'murder', 'attack', 'violence'];
    return this.keywordScore(text, violenceKeywords);
  }
  
  private detectAdultContent(text: string): number {
    const adultKeywords = ['explicit', 'nsfw', 'adult'];
    return this.keywordScore(text, adultKeywords);
  }
  
  private detectSpamKeywords(text: string): number {
    const spamKeywords = ['buy now', 'click here', 'free money', 'urgent'];
    return this.keywordScore(text, spamKeywords);
  }
  
  private detectMisinformation(text: string): number {
    const misinfoKeywords = ['fake news', 'conspiracy', 'hoax'];
    return this.keywordScore(text, misinfoKeywords);
  }
  
  private detectSuspiciousLinks(text: string): number {
    const linkCount = (text.match(/https?:\/\/[^\s]+/g) || []).length;
    const suspiciousCount = (text.match(/bit\.ly|tinyurl|t\.co/g) || []).length;
    
    if (linkCount === 0) return 0;
    return suspiciousCount / linkCount;
  }
  
  private detectPromotionalContent(text: string): number {
    const promoKeywords = ['sale', 'discount', 'offer', 'deal', 'buy', 'shop'];
    return this.keywordScore(text, promoKeywords);
  }
  
  private detectRapidPosting(authorId: string, createdAt: Date): number {
    // Simulate rapid posting detection
    // In production, this would check actual posting frequency
    return Math.random() * 0.3; // Low random score
  }
  
  private detectFakeEngagement(item: MMRContentItem): number {
    // Simulate fake engagement detection
    // In production, this would analyze engagement patterns
    return Math.random() * 0.2; // Low random score
  }
  
  private keywordScore(text: string, keywords: string[]): number {
    const lowerText = text.toLowerCase();
    let matches = 0;
    
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        matches++;
      }
    }
    
    return Math.min(matches / keywords.length, 1);
  }
  
  private initializePatterns(): void {
    // Initialize spam patterns and safety keywords
    this.spamPatterns = [
      /\b(buy now|click here|free money|urgent|limited time)\b/gi,
      /\b(viagra|casino|lottery|winner)\b/gi
    ];
    
    // Initialize safety keywords with scores
    const safetyWords = [
      'harassment', 'bully', 'threaten', 'hate', 'racist',
      'violence', 'kill', 'attack', 'explicit', 'nsfw'
    ];
    
    for (const word of safetyWords) {
      this.safetyKeywords.set(word, 0.8);
    }
  }
  
  private getDefaultSafety(): SafetyAssessment {
    return {
      isAppropriate: true,
      riskLevel: 'low',
      categories: {
        harassment: 0,
        hateSpeech: 0,
        violence: 0,
        adultContent: 0,
        spam: 0,
        misinformation: 0
      },
      confidence: 0.5
    };
  }
  
  private getDefaultSpam(): SpamDetection {
    return {
      isSpam: false,
      spamScore: 0,
      indicators: {
        repetitiveContent: 0,
        suspiciousLinks: 0,
        promotionalContent: 0,
        lowQualityText: 0,
        rapidPosting: 0,
        fakeEngagement: 0
      },
      confidence: 0.5
    };
  }
  
  private createFallbackAssessment(contentId: string, startTime: number): QualityAssessment {
    return {
      contentId,
      overallScore: 0.5,
      qualityMetrics: {
        contentQuality: 0.5,
        safetyScore: 1,
        spamScore: 0,
        engagementPrediction: 0.5
      },
      flags: [],
      recommendations: ['Assessment failed - using fallback'],
      processingTimeMs: Date.now() - startTime,
      confidence: 0.1
    };
  }
  
  /**
   * Get assessment statistics
   */
  public getStats(): {
    totalAssessments: number;
    cacheHitRate: number;
    averageProcessingTime: number;
    qualityDistribution: Record<string, number>;
  } {
    return {
      totalAssessments: this.contentCache.size,
      cacheHitRate: 0.85, // Simulated
      averageProcessingTime: 5, // ms
      qualityDistribution: {
        high: 0.3,
        medium: 0.5,
        low: 0.2
      }
    };
  }
  
  /**
   * Clear caches and reset
   */
  public clearCache(): void {
    this.contentCache.clear();
    this.feedbackHistory.clear();
  }
}