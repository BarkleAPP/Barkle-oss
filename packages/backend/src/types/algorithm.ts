/**
 * Advanced Timeline Algorithm Types and Interfaces
 */

export interface UserInteraction {
	type: 'reaction' | 'share' | 'comment' | 'view' | 'dwell' | 'skip' | 'block' | 'renote';
	contentId: string;
	timestamp: Date;
	duration?: number; // for dwell time in milliseconds
	context: InteractionContext;
	reactionType?: string; // for reaction interactions (e.g., '❤️', '👍', '😂')
}

export interface InteractionContext {
	deviceType: 'mobile' | 'desktop' | 'tablet';
	timeOfDay: number; // hour of day (0-23)
	location?: string; // optional location context
	sessionId: string;
	scrollPosition?: number;
	viewportSize?: { width: number; height: number };
}

export interface UserProfile {
	userId: string;
	embedding: number[]; // 256-dimensional user representation
	interestCategories: Map<string, number>; // category -> weight
	engagementPatterns: {
		avgDwellTime: number;
		preferredContentTypes: string[];
		activeTimeWindows: TimeWindow[];
		socialInfluence: number; // how much user follows social signals (0-1)
	};
	diversityPreference: number; // 0-1, higher = more exploration
	lastUpdated: Date;
	interactionHistory: UserInteractionSummary[];
}

export interface TimeWindow {
	startHour: number; // 0-23
	endHour: number; // 0-23
	dayOfWeek?: number; // 0-6, optional for specific days
	engagementLevel: number; // 0-1
}

export interface UserInteractionSummary {
	contentId: string;
	interactionType: UserInteraction['type'];
	timestamp: Date;
	score: number; // positive/negative engagement score
}

export interface ContentFeatures {
	contentId: string;
	embedding: number[]; // 256-dimensional content representation
	metadata: {
		authorId: string;
		createdAt: Date;
		contentType: 'text' | 'image' | 'video' | 'poll' | 'renote';
		topics: string[];
		language: string;
		hasMedia: boolean;
		textLength?: number;
		mediaCount?: number;
	};
	engagement: {
		reactions: number;
		shares: number;
		comments: number;
		views: number;
		renotes: number;
		engagementRate: number;
		viralityScore: number;
	};
	freshness: number; // time-based decay factor (0-1)
	qualityScore: number; // content quality assessment (0-1)
}

export interface TimelineCache {
	userId: string;
	content: RankedContent[];
	generatedAt: Date;
	cursor: string; // for pagination
	ttl: number; // cache expiration in seconds
	version: string; // for cache invalidation
	algorithmVersion: string; // algorithm version used
}

export interface ContentCandidate {
	contentId: string;
	source: CandidateSource;
	baseScore: number;
	features: ContentFeatures;
	socialSignals?: SocialSignals;
}

export type CandidateSource = 
	| 'following'
	| 'followed_users'
	| 'network_3deg'
	| 'contacts'
	| 'collaborative'
	| 'content_based'
	| 'trending'
	| 'exploration';

export interface SocialSignals {
	followingEngagement: number; // engagement from users you follow
	mutualConnections: number; // number of mutual connections with author
	networkPath: string[]; // path through social graph
	influenceScore: number; // PageRank-style scoring
	degreeFromUser: number; // 1, 2, or 3 degrees of separation
}

export interface RankedContent {
	contentId: string;
	userId: string; // author
	relevanceScore: number;
	diversityScore: number;
	finalScore: number;
	source: CandidateSource;
	features: ContentFeatures;
	socialSignals?: SocialSignals;
	rankingFactors: RankingFactors;
}

export interface RankingFactors {
	personalRelevance: number;
	socialRelevance: number;
	contentQuality: number;
	freshness: number;
	diversity: number;
	exploration: number;
}

export interface EngagementPrediction {
	reactionProb: number;
	shareProb: number;
	commentProb: number;
	renoteProb: number;
	dwellTime: number; // predicted dwell time in seconds
	skipProb: number;
	overallEngagement: number; // combined engagement score
}

export interface NetworkGraph {
	nodes: NetworkNode[];
	edges: NetworkEdge[];
	influenceScores: Map<string, number>;
}

export interface NetworkNode {
	userId: string;
	influenceScore: number;
	connectionStrength: number;
	lastInteraction: Date;
}

export interface NetworkEdge {
	fromUserId: string;
	toUserId: string;
	weight: number; // connection strength
	interactionFrequency: number;
	lastInteraction: Date;
}

export interface NetworkRecommendation {
	contentId: string;
	authorId: string;
	networkPath: string[]; // path through social graph
	influenceScore: number; // PageRank-style scoring
	degreeFromUser: number; // 1, 2, or 3 degrees
	connectionStrength: number;
}

export interface ContactRecommendation {
	contentId: string;
	authorId: string;
	contactRelation: 'direct' | 'mutual_contact' | 'contact_of_contact';
	matchStrength: number; // how strong the contact connection is
	privacyRespected: boolean; // ensures privacy settings are honored
}

export interface ContactMatch {
	userId: string;
	contactInfo: string; // hashed for privacy
	matchType: 'phone' | 'email' | 'name';
	confidence: number;
}

export interface AlgorithmMetrics {
	userId: string;
	timestamp: Date;
	engagementRate: number;
	diversityScore: number;
	userSatisfaction: number;
	latency: number;
	cacheHitRate: number;
}

export interface TimelineBatch {
	content: RankedContent[];
	cursor: string;
	hasMore: boolean;
	generatedAt: Date;
	batchSize: number;
	caughtUp?: CaughtUpStatus; // Optional caught up indicator
}

// Redis cache schemas
export interface UserEmbeddingCache {
	userId: string;
	embedding: number[];
	lastUpdated: Date;
	version: string;
}

export interface ContentEmbeddingCache {
	contentId: string;
	embedding: number[];
	features: ContentFeatures;
	lastUpdated: Date;
	version: string;
}

export interface InteractionEventCache {
	userId: string;
	interactions: UserInteraction[];
	lastProcessed: Date;
	batchId: string;
}

// Infinite scroll and pagination interfaces
export interface ScrollState {
	totalBatches: number;
	cachedBatches: number;
	lastPreloadTime: Date;
	currentPosition?: number;
	scrollDirection?: 'up' | 'down';
}

export interface CaughtUpStatus {
	isCaughtUp: boolean;
	oldestContentDate: Date | null;
	daysSinceContent?: number;
}

export interface InfiniteScrollOptions {
	preloadThreshold: number; // 0-1, when to trigger preload
	batchSize: number;
	maxCachedBatches: number;
	enableOfflineCache: boolean;
}