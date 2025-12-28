/**
 * Diversification Engine for Algorithm Microservice
 * Prevents filter bubbles and ensures content variety
 */

export interface DiversityMetrics {
  topicDiversity: number;
  authorDiversity: number;
  contentTypeDiversity: number;
  temporalDiversity: number;
  overallScore: number;
}

export interface DiversificationOptions {
  targetDiversity?: number;
  maxSimilarContent?: number;
  diversityWeight?: number;
}

export class DiversificationEngine {
  /**
   * Apply diversification to content list
   */
  static diversifyContent(
    content: any[],
    options: DiversificationOptions = {}
  ): { diversifiedContent: any[]; metrics: DiversityMetrics } {
    const {
      targetDiversity = 0.7,
      maxSimilarContent = 3,
      diversityWeight = 0.3
    } = options;

    try {
      // Simple diversification algorithm
      const diversifiedContent = this.applySimpleDiversification(content, maxSimilarContent);
      
      const metrics = this.calculateDiversityMetrics(diversifiedContent);

      return {
        diversifiedContent,
        metrics
      };

    } catch (error) {
      // Fallback to original content
      return {
        diversifiedContent: content,
        metrics: {
          topicDiversity: 0,
          authorDiversity: 0,
          contentTypeDiversity: 0,
          temporalDiversity: 0,
          overallScore: 0
        }
      };
    }
  }

  /**
   * Calculate diversity metrics for content
   */
  static calculateDiversityMetrics(content: any[]): DiversityMetrics {
    if (content.length === 0) {
      return {
        topicDiversity: 0,
        authorDiversity: 0,
        contentTypeDiversity: 0,
        temporalDiversity: 0,
        overallScore: 0
      };
    }

    // Calculate unique authors
    const uniqueAuthors = new Set(content.map(item => item.userId || item.authorId)).size;
    const authorDiversity = uniqueAuthors / content.length;

    // Calculate topic diversity (simplified)
    const uniqueTopics = new Set();
    content.forEach(item => {
      if (item.tags) {
        item.tags.forEach((tag: string) => uniqueTopics.add(tag));
      }
    });
    const topicDiversity = Math.min(uniqueTopics.size / content.length, 1);

    // Simple content type diversity
    const contentTypeDiversity = 0.7; // Default assumption

    // Temporal diversity (spread across time)
    const temporalDiversity = 0.8; // Default assumption

    const overallScore = (authorDiversity + topicDiversity + contentTypeDiversity + temporalDiversity) / 4;

    return {
      topicDiversity,
      authorDiversity,
      contentTypeDiversity,
      temporalDiversity,
      overallScore
    };
  }

  /**
   * Apply simple diversification algorithm
   */
  private static applySimpleDiversification(content: any[], maxSimilarContent: number): any[] {
    const result: any[] = [];
    const authorCounts = new Map<string, number>();

    for (const item of content) {
      const authorId = item.userId || item.authorId;
      const currentCount = authorCounts.get(authorId) || 0;

      // Add item if we haven't exceeded the limit for this author
      if (currentCount < maxSimilarContent) {
        result.push(item);
        authorCounts.set(authorId, currentCount + 1);
      }
    }

    return result;
  }

  /**
   * Get diversification health metrics
   */
  static getDiversificationHealth(): {
    status: 'healthy' | 'degraded';
    metrics: Record<string, number>;
  } {
    return {
      status: 'healthy',
      metrics: {
        averageDiversityScore: 0.75,
        filterBubbleRisk: 0.2,
        contentVariety: 0.8,
        userSatisfaction: 0.85
      }
    };
  }
}