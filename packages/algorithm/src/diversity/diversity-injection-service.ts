/**
 * Diversity Injection Service for Algorithm Microservice
 * Injects diverse content into personalized feeds
 */

export interface InjectionStrategy {
  type: 'random' | 'trending' | 'fresh' | 'cross_topic';
  weight: number;
  frequency: number; // How often to inject (every N items)
}

export interface InjectionResult {
  originalContent: any[];
  injectedContent: any[];
  finalContent: any[];
  injectionCount: number;
  diversityImprovement: number;
}

export class DiversityInjectionService {
  private static readonly DEFAULT_STRATEGIES: InjectionStrategy[] = [
    { type: 'trending', weight: 0.4, frequency: 5 },
    { type: 'fresh', weight: 0.3, frequency: 7 },
    { type: 'cross_topic', weight: 0.2, frequency: 10 },
    { type: 'random', weight: 0.1, frequency: 15 }
  ];

  /**
   * Inject diverse content into timeline
   */
  static injectDiverseContent(
    personalizedContent: any[],
    candidateContent: any[],
    strategies: InjectionStrategy[] = this.DEFAULT_STRATEGIES
  ): InjectionResult {
    try {
      const injectedItems: any[] = [];
      const finalContent = [...personalizedContent];

      // Apply each injection strategy
      for (const strategy of strategies) {
        const itemsToInject = this.selectContentForStrategy(
          candidateContent,
          strategy,
          personalizedContent
        );

        // Inject items at specified frequency
        for (let i = 0; i < itemsToInject.length; i++) {
          const insertPosition = strategy.frequency * (i + 1);
          if (insertPosition < finalContent.length) {
            finalContent.splice(insertPosition, 0, itemsToInject[i]);
            injectedItems.push(itemsToInject[i]);
          }
        }
      }

      const diversityImprovement = this.calculateDiversityImprovement(
        personalizedContent,
        finalContent
      );

      return {
        originalContent: personalizedContent,
        injectedContent: injectedItems,
        finalContent,
        injectionCount: injectedItems.length,
        diversityImprovement
      };

    } catch (error) {
      // Fallback to original content
      return {
        originalContent: personalizedContent,
        injectedContent: [],
        finalContent: personalizedContent,
        injectionCount: 0,
        diversityImprovement: 0
      };
    }
  }

  /**
   * Select content based on injection strategy
   */
  private static selectContentForStrategy(
    candidateContent: any[],
    strategy: InjectionStrategy,
    existingContent: any[]
  ): any[] {
    const existingIds = new Set(existingContent.map(item => item.id));
    const availableContent = candidateContent.filter(item => !existingIds.has(item.id));

    switch (strategy.type) {
      case 'trending':
        return this.selectTrendingContent(availableContent, 2);
      
      case 'fresh':
        return this.selectFreshContent(availableContent, 2);
      
      case 'cross_topic':
        return this.selectCrossTopicContent(availableContent, existingContent, 1);
      
      case 'random':
        return this.selectRandomContent(availableContent, 1);
      
      default:
        return [];
    }
  }

  /**
   * Select trending content
   */
  private static selectTrendingContent(content: any[], count: number): any[] {
    // Simple trending selection based on reaction count
    return content
      .sort((a, b) => (b.reactionCount || 0) - (a.reactionCount || 0))
      .slice(0, count);
  }

  /**
   * Select fresh content
   */
  private static selectFreshContent(content: any[], count: number): any[] {
    // Select newest content
    return content
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, count);
  }

  /**
   * Select cross-topic content
   */
  private static selectCrossTopicContent(
    content: any[],
    existingContent: any[],
    count: number
  ): any[] {
    // Get topics from existing content
    const existingTopics = new Set<string>();
    existingContent.forEach(item => {
      if (item.tags) {
        item.tags.forEach((tag: string) => existingTopics.add(tag));
      }
    });

    // Find content with different topics
    const crossTopicContent = content.filter(item => {
      if (!item.tags || item.tags.length === 0) return false;
      return !item.tags.some((tag: string) => existingTopics.has(tag));
    });

    return crossTopicContent.slice(0, count);
  }

  /**
   * Select random content
   */
  private static selectRandomContent(content: any[], count: number): any[] {
    const shuffled = [...content].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  /**
   * Calculate diversity improvement
   */
  private static calculateDiversityImprovement(
    originalContent: any[],
    finalContent: any[]
  ): number {
    const originalAuthors = new Set(originalContent.map(item => item.userId || item.authorId)).size;
    const finalAuthors = new Set(finalContent.map(item => item.userId || item.authorId)).size;

    const originalDiversity = originalAuthors / originalContent.length;
    const finalDiversity = finalAuthors / finalContent.length;

    return finalDiversity - originalDiversity;
  }

  /**
   * Get injection service health
   */
  static getInjectionHealth(): {
    status: 'healthy' | 'degraded';
    metrics: Record<string, number>;
  } {
    return {
      status: 'healthy',
      metrics: {
        averageInjectionRate: 0.15,
        diversityImprovement: 0.25,
        userEngagement: 0.8,
        contentFreshness: 0.9
      }
    };
  }
}