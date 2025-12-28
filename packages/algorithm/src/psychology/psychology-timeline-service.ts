/**
 * 🧠 Psychology-Enhanced Timeline Integration
 * 
 * Integrates behavioral addiction engine into timeline generation
 * for maximum user engagement and retention
 */

import { BehavioralAddictionEngine, PsychologyConfig, ContentItem, PsychologyEnhancedContent } from './behavioral-addiction-engine.js';

// Generic note type (replace with actual import in backend integration)
interface Note {
  id: string;
  userId: string;
  createdAt: Date;
  viralityScore?: number;
  reactionsCount?: number;
  renotesCount?: number;
  repliesCount?: number;
  viewsCount?: number;
  fileIds?: string[];
  poll?: any;
  cw?: string;
  user?: {
    followersCount?: number;
  };
}

/**
 * Convert Note to ContentItem for psychology engine
 */
function noteToContentItem(note: Note): ContentItem {
  return {
    id: note.id,
    score: 0, // Will be set by ranker
    viralityScore: note.viralityScore,
    engagement: {
      reactions: note.reactionsCount || 0,
      shares: note.renotesCount || 0,
      comments: note.repliesCount || 0,
      views: note.viewsCount
    },
    author: {
      id: note.userId,
      followersCount: note.user?.followersCount
    },
    createdAt: note.createdAt,
    metadata: {
      hasMedia: (note.fileIds?.length || 0) > 0,
      isPoll: !!note.poll,
      cw: note.cw
    }
  };
}

/**
 * Psychology-Enhanced Timeline Service
 * 
 * Wraps existing timeline generation with addiction psychology
 */
export class PsychologyTimelineService {
  private addictionEngine: BehavioralAddictionEngine;

  constructor(config?: Partial<PsychologyConfig>) {
    this.addictionEngine = new BehavioralAddictionEngine(config);
  }

  /**
   * Enhance timeline with psychology-based engagement optimization
   * 
   * This is the MAIN integration point - call this after ranking but before returning timeline
   */
  public enhanceTimeline(
    notes: Note[],
    userId: string,
    userContext?: {
      following: string[];
      similarUsers?: string[];
    }
  ): PsychologyEnhancedContent[] {
    // 1. Convert notes to content items
    const contentItems = notes.map(noteToContentItem);

    // 2. Apply variable reward schedule (unpredictability)
    let enhanced = this.addictionEngine.applyVariableRewardSchedule(
      contentItems,
      userId
    );

    // 3. Apply FOMO mechanics (urgency, scarcity)
    enhanced = this.addictionEngine.applyFOMOMechanics(enhanced);

    // 4. Apply social proof (network effects)
    enhanced = this.addictionEngine.applySocialProof(
      enhanced,
      userContext?.following,
      { similarUsers: userContext?.similarUsers }
    );

    // 5. Re-sort by enhanced score (psychology-boosted)
    enhanced.sort((a, b) => b.enhancedScore - a.enhancedScore);

    return enhanced;
  }

  /**
   * Get random notification delay for dopamine anticipation
   */
  public getNotificationDelay(): number {
    return this.addictionEngine.getNotificationDelay();
  }

  /**
   * Get user engagement statistics
   */
  public getUserStats(userId: string) {
    return this.addictionEngine.getUserStats(userId);
  }

  /**
   * Update psychology configuration (for A/B testing)
   */
  public updateConfig(config: Partial<PsychologyConfig>): void {
    this.addictionEngine.updateConfig(config);
  }

  /**
   * Get current configuration
   */
  public getConfig(): PsychologyConfig {
    return this.addictionEngine.getConfig();
  }
}

/**
 * Global psychology timeline service instance
 */
let globalPsychologyService: PsychologyTimelineService | null = null;

/**
 * Get or create global psychology timeline service
 */
export function getPsychologyTimelineService(
  config?: Partial<PsychologyConfig>
): PsychologyTimelineService {
  if (!globalPsychologyService) {
    globalPsychologyService = new PsychologyTimelineService(config);
  } else if (config) {
    globalPsychologyService.updateConfig(config);
  }
  return globalPsychologyService;
}

/**
 * Example A/B Test Configurations
 */

// Control: No psychology features (minimal config)
export const CONTROL_CONFIG: Partial<PsychologyConfig> = {
  variableReward: {
    enabled: false,
    unpredictabilityLevel: 0,
    surpriseContentRate: 0,
    nearMissRate: 0
  },
  dopamineTriggers: {
    enabled: false,
    notificationDelay: { min: 0, max: 0 },
    rewardIntensityVariance: 0,
    anticipationBuildup: false
  },
  fomoMechanics: {
    enabled: false,
    showTrendingIndicators: false
  },
  socialProof: {
    enabled: false,
    notifyFollowerEngagement: false,
    notifyPopularityMilestones: false,
    notifyNewFollowers: false,
    notifySimilarUserActivity: false,
    notifyNetworkActivity: false
  },
  intermittentReinforcement: {
    enabled: false,
    rewardProbability: 0,
    jackpotProbability: 0,
    coldStreakProtection: false,
    maxColdStreak: 0
  }
};

// Light: Mild psychology features
export const LIGHT_PSYCHOLOGY_CONFIG: Partial<PsychologyConfig> = {
  variableReward: {
    enabled: true,
    unpredictabilityLevel: 0.3,
    surpriseContentRate: 0.05,
    nearMissRate: 0.05
  },
  fomoMechanics: {
    enabled: true,
    showTrendingIndicators: true
  },
  socialProof: {
    enabled: true,
    notifyFollowerEngagement: true,
    notifyPopularityMilestones: false,
    notifyNewFollowers: false,
    notifySimilarUserActivity: false,
    notifyNetworkActivity: false
  }
};

// Aggressive: Full psychology optimization (Twitter/TikTok level)
export const AGGRESSIVE_PSYCHOLOGY_CONFIG: Partial<PsychologyConfig> = {
  variableReward: {
    enabled: true,
    unpredictabilityLevel: 0.7,
    surpriseContentRate: 0.15,
    nearMissRate: 0.1
  },
  dopamineTriggers: {
    enabled: true,
    notificationDelay: { min: 2000, max: 30000 },
    rewardIntensityVariance: 0.5,
    anticipationBuildup: true
  },
  fomoMechanics: {
    enabled: true,
    showTrendingIndicators: true
  },
  socialProof: {
    enabled: true,
    notifyFollowerEngagement: true,
    notifyPopularityMilestones: true,
    notifyNewFollowers: true,
    notifySimilarUserActivity: true,
    notifyNetworkActivity: true
  },
  intermittentReinforcement: {
    enabled: true,
    rewardProbability: 0.3,
    jackpotProbability: 0.05,
    coldStreakProtection: true,
    maxColdStreak: 8
  }
};
