import { Entity, Column, Index, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { id } from '../id.js';

/**
 * Algorithm A/B Test Experiment Configuration
 * Persists experiment definitions so they survive server reboots
 */
@Entity()
@Index(['status', 'startDate'])
export class AlgorithmExperiment {
	@PrimaryColumn(id())
	public id: string;

	@Column('varchar', {
		length: 255,
		comment: 'Human-readable experiment name',
	})
	public name: string;

	@Column('text', {
		nullable: true,
		comment: 'Detailed description of what this experiment tests',
	})
	public description: string | null;

	@Index()
	@Column('enum', {
		enum: ['draft', 'active', 'paused', 'completed'],
		default: 'draft',
		comment: 'Current experiment status',
	})
	public status: 'draft' | 'active' | 'paused' | 'completed';

	@Index()
	@CreateDateColumn()
	public startDate: Date;

	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'When the experiment ended',
	})
	public endDate: Date | null;

	@Column('decimal', {
		precision: 3,
		scale: 2,
		default: 0.1,
		comment: 'Percentage of users to include in experiment (0-1)',
	})
	public trafficAllocation: number;

	@Column('jsonb', {
		comment: 'Experiment variants with their configurations and allocations',
	})
	public variants: Record<string, {
		name: string;
		description: string;
		allocation: number;
		config: {
			// Algorithm weights
			weights: {
				relevance: number;
				diversity: number;
				freshness: number;
				quality: number;
				personalization: number;
				serendipity: number;
			};
			// MMR parameters
			mmr: {
				enabled: boolean;
				lambda: number;
				similarityThreshold: number;
				maxResults: number;
			};
			// Quality filtering
			quality: {
				enabled: boolean;
				threshold: number;
				safetyThreshold: number;
				spamThreshold: number;
			};
			// Multi-signal injection
			multiSignal: {
				enabled: boolean;
				strategies: {
					trending: { enabled: boolean; weight: number; frequency: number };
					fresh: { enabled: boolean; weight: number; frequency: number };
					crossTopic: { enabled: boolean; weight: number; frequency: number };
					serendipity: { enabled: boolean; weight: number; frequency: number };
				};
			};
			// Performance settings
			performance: {
				maxProcessingTime: number;
				cacheEnabled: boolean;
				precomputationEnabled: boolean;
			};
			// Content mixing ratios
			contentMix: {
				followingContent: number;
				discoveryContent: number;
				trendingContent: number;
				personalizedContent: number;
			};
			// Diversity controls
			diversityControls: {
				maxPostsPerUser: number;
				maxSelfPosts: number;
				minimumRetention: number;
				showTimelineReplies: boolean;
			};
			// Share-based ranking (Instagram-style)
			shareBoost?: {
				enabled: boolean;
				shareMultiplier: number;
				externalShareMultiplier: number;
			};
			// Recommendation basis
			recommendation?: {
				basis: 'follows' | 'interactions' | 'shares' | 'hybrid';
				followingWeight: number;
				interactionWeight: number;
				shareWeight: number;
			};
			// 🧠 PSYCHOLOGY: Variable reward schedules
			psychologyTactics?: {
				variableReward: {
					enabled: boolean;
					unpredictabilityLevel: number; // 0-1, higher = more random
					surpriseContentRate: number; // % of surprising content to inject
				};
				dopamineTriggers: {
					enabled: boolean;
					notificationDelay: { min: number; max: number }; // Random delay
					rewardIntensityVariance: number; // How much rewards vary
				};
				fomoMechanics: {
					enabled: boolean;
					showTrendingIndicators: boolean;
					showViewCounts: boolean;
					urgencySignals: boolean; // "X people viewing now"
				};
				socialProof: {
					enabled: boolean;
					showFollowerEngagement: boolean; // "People you follow liked this"
					showPopularityMetrics: boolean;
					highlightNewFollowers: boolean;
				};
			};
		};
	}>;

	@Column('varchar', {
		length: 128,
		comment: 'Primary metric to optimize (e.g., engagement_rate)',
	})
	public primaryMetric: string;

	@Column('jsonb', {
		default: [],
		comment: 'Secondary metrics to track',
	})
	public secondaryMetrics: string[];

	@Column('integer', {
		default: 100,
		comment: 'Minimum sample size before drawing conclusions',
	})
	public minimumSampleSize: number;

	@Column('decimal', {
		precision: 3,
		scale: 2,
		default: 0.95,
		comment: 'Statistical confidence level (0-1)',
	})
	public confidenceLevel: number;

	@Column('jsonb', {
		nullable: true,
		comment: 'Targeting rules (user segments, device types, etc.)',
	})
	public targetingRules: {
		userSegments?: string[];
		deviceTypes?: string[];
		regions?: string[];
		newUsersOnly?: boolean;
	} | null;

	@UpdateDateColumn()
	public updatedAt: Date;

	constructor(data?: Partial<AlgorithmExperiment>) {
		if (data) {
			Object.assign(this, data);
		}
	}
}
