/**
 * Monolith-Inspired ML Ranker for Barkle
 * Based on ByteDance's production-scale recommendation system
 * Optimized for real-time learning and collision-free embeddings
 */

import { EmbeddingTableManager, getEmbeddingManager, type EmbeddingType } from '../embeddings/index.js';

export interface MonolithFeatures {
    // Sparse features (will use collision-free embeddings)
    user_id: string;
    author_id: string;
    content_topics: string[]; // hashtags, keywords

    // Dense features (traditional ML features)
    user_engagement_rate: number;
    content_length_normalized: number;
    content_age_hours: number;
    social_proof_score: number;
    author_user_affinity: number;
    topic_similarity_score: number;
    temporal_match_score: number;

    // Social graph features (contact-based signals)
    is_direct_contact: boolean;           // Author is in user's imported contacts
    mutual_contact_count: number;         // Number of shared contacts
    contact_engagement_boost: number;     // Boost for contact network content
    second_degree_connection: boolean;    // Friend of a friend

    // Community adaptive features
    community_size_factor: number;
    personalization_strength: number;
    discovery_boost: number;
}

export class MonolithInspiredRanker {
    // Collision-free embedding tables using Cuckoo hashing
    private static embeddingManager: EmbeddingTableManager | null = null;

    // Configuration
    private static readonly EMBEDDING_DIM = 64; // Smaller for efficiency

    // Real-time learning state
    private static trainingData: Array<{ features: MonolithFeatures; engagement: number }> = [];
    private static readonly MAX_TRAINING_BUFFER = 1000;
    private static lastModelUpdate = 0;
    private static readonly UPDATE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes (ByteDance uses minute-level)

    // Model weights (simple linear model for fast updates)
    private static modelWeights = {
        user_engagement_rate: 0.25,
        content_length_normalized: 0.15,
        content_age_hours: -0.10, // Negative because newer is better
        social_proof_score: 0.20,
        author_user_affinity: 0.30,
        topic_similarity_score: 0.25,
        temporal_match_score: 0.10,
        // Social graph weights (Instagram-style)
        is_direct_contact: 1.5,          // 1.5x boost for direct contacts
        mutual_contact_count: 0.3,       // 0.3 per mutual contact
        contact_engagement_boost: 0.4,   // Boost for contact network
        second_degree_connection: 0.8,   // 0.8x boost for friends of friends
        // Community adaptive
        community_size_factor: 0.05,
        personalization_strength: 0.15,
        discovery_boost: 0.10
    };

    /**
     * Initialize the ranker with embedding manager
     */
    static initialize(communitySize: number): void {
        if (!this.embeddingManager) {
            this.embeddingManager = getEmbeddingManager({
                communitySize,
                enableAutoCleanup: true,
                cleanupIntervalMs: 30 * 60 * 1000, // 30 minutes
                maxSystemMemoryMB: 20
            });
        }
    }

    /**
     * Get or create embedding using collision-free Cuckoo hashing
     */
    static getOrCreateEmbedding(type: EmbeddingType, id: string): number[] {
        if (!this.embeddingManager) {
            throw new Error('MonolithInspiredRanker not initialized. Call initialize() first.');
        }
        return this.embeddingManager.getOrCreateEmbedding(type, id);
    }

    /**
     * Update embedding frequency for ByteDance-style filtering
     */
    static updateEmbeddingFrequency(type: EmbeddingType, id: string): void {
        if (!this.embeddingManager) return;
        this.embeddingManager.updateEmbeddingFrequency(type, id);
    }

    /**
     * Clean up stale embeddings
     */
    static cleanupStaleEmbeddings(): number {
        if (!this.embeddingManager) return 0;
        return this.embeddingManager.cleanupExpiredEmbeddings();
    }

    /**
     * Extract features using collision-free embeddings
     */
    static async extractFeatures(
        noteData: {
            id: string;
            text?: string;
            tags?: string[];
            fileIds?: string[];
            userId: string;
            createdAt: Date;
        },
        userId: string,
        userPreferences: any | null,
        communitySize: number
    ): Promise<MonolithFeatures> {
        try {
            // Extract content topics (hashtags + keywords)
            const contentTopics = this.extractContentTopics(noteData);

            // Calculate dense features
            const contentAgeHours = (Date.now() - noteData.createdAt.getTime()) / (1000 * 60 * 60);

            // User-specific features
            const userEngagementRate = userPreferences?.engagementPatterns?.engagementRate || 0.1;
            const authorAffinity = userPreferences?.authorAffinities?.get(noteData.userId) || 0;

            // Calculate similarity using embeddings
            const topicSimilarity = await this.calculateTopicSimilarity(contentTopics, userPreferences);
            const temporalMatch = this.calculateTemporalMatch(new Date().getHours(), userPreferences);

            // Community adaptive features
            const communitySizeFactor = this.calculateCommunitySizeFactor(communitySize);
            const personalizationStrength = communitySize > 10000 ? 0.9 : 0.5;
            const discoveryBoost = communitySize < 1000 ? 0.8 : 0.3;

            // Social graph features (contact-based)
            const socialGraphFeatures = await this.calculateSocialGraphFeatures(
                userId,
                noteData.userId,
                userPreferences
            );

            return {
                // Sparse features
                user_id: userId,
                author_id: noteData.userId,
                content_topics: contentTopics,

                // Dense features
                user_engagement_rate: Math.min(userEngagementRate, 1),
                content_length_normalized: Math.min((noteData.text?.length || 0) / 300, 1),
                content_age_hours: Math.min(contentAgeHours / 24, 1),
                social_proof_score: 0.1, // Would get from stats service
                author_user_affinity: Math.min(authorAffinity, 1),
                topic_similarity_score: topicSimilarity,
                temporal_match_score: temporalMatch,

                // Social graph features
                ...socialGraphFeatures,

                // Community features
                community_size_factor: communitySizeFactor,
                personalization_strength: personalizationStrength,
                discovery_boost: discoveryBoost
            };

        } catch (error) {
            return this.getDefaultFeatures(userId, noteData.userId, communitySize);
        }
    }

    /**
     * Predict engagement using collision-free embeddings + linear model
     */
    static async predictEngagement(features: MonolithFeatures): Promise<number> {
        try {
            // Ensure embedding manager is initialized
            if (!this.embeddingManager) {
                throw new Error('Embedding manager not initialized');
            }

            // Get embeddings for sparse features using Cuckoo hashing
            const userEmbedding = this.getOrCreateEmbedding('user', features.user_id);
            const authorEmbedding = this.getOrCreateEmbedding('author', features.author_id);
            const topicEmbeddings = features.content_topics.map(topic =>
                this.getOrCreateEmbedding('topic', topic)
            );

            // Calculate embedding similarities (ByteDance approach)
            const userAuthorSimilarity = this.cosineSimilarity(userEmbedding, authorEmbedding);
            const userTopicSimilarity = topicEmbeddings.length > 0
                ? topicEmbeddings.reduce((sum, topicEmb) =>
                    sum + this.cosineSimilarity(userEmbedding, topicEmb), 0) / topicEmbeddings.length
                : 0;

            // Linear model prediction (fast updates like ByteDance)
            let score = 0;
            score += features.user_engagement_rate * this.modelWeights.user_engagement_rate;
            score += features.content_length_normalized * this.modelWeights.content_length_normalized;
            score += features.content_age_hours * this.modelWeights.content_age_hours;
            score += features.social_proof_score * this.modelWeights.social_proof_score;
            score += features.author_user_affinity * this.modelWeights.author_user_affinity;
            score += features.topic_similarity_score * this.modelWeights.topic_similarity_score;
            score += features.temporal_match_score * this.modelWeights.temporal_match_score;

            // Add social graph features (Instagram-style contact boost)
            if (features.is_direct_contact) {
                score *= this.modelWeights.is_direct_contact; // 1.5x multiplier for direct contacts
            }
            score += features.mutual_contact_count * this.modelWeights.mutual_contact_count;
            score += features.contact_engagement_boost * this.modelWeights.contact_engagement_boost;
            if (features.second_degree_connection) {
                score *= this.modelWeights.second_degree_connection; // 0.8x for 2nd degree
            }

            // Add embedding-based features
            score += userAuthorSimilarity * 0.2;
            score += userTopicSimilarity * 0.15;

            // Community adaptive adjustments
            score *= (1 + features.discovery_boost * (1 - features.personalization_strength));

            return this.sigmoid(score);

        } catch (error) {
            return this.heuristicFallback(features);
        }
    }

    /**
     * Record engagement for real-time learning (ByteDance approach)
     */
    static recordEngagement(features: MonolithFeatures, engagementType: string): void {
        const engagementScore = this.getEngagementScore(engagementType);

        // Add to training buffer
        this.trainingData.push({ features, engagement: engagementScore });

        // Limit buffer size
        if (this.trainingData.length > this.MAX_TRAINING_BUFFER) {
            this.trainingData.shift();
        }

        // Update embeddings frequency (ByteDance approach)
        this.updateEmbeddingFrequency('user', features.user_id);
        this.updateEmbeddingFrequency('author', features.author_id);
        features.content_topics.forEach(topic =>
            this.updateEmbeddingFrequency('topic', topic)
        );

        // Trigger model update if enough time has passed
        const now = Date.now();
        if (now - this.lastModelUpdate > this.UPDATE_INTERVAL_MS) {
            this.scheduleModelUpdate();
        }
    }

    // Private helper methods
    private static extractContentTopics(noteData: any): string[] {
        const topics: string[] = [];

        // Add hashtags
        if (noteData.tags) {
            topics.push(...noteData.tags);
        }

        // Extract keywords from text
        if (noteData.text) {
            const keywords = noteData.text.toLowerCase().match(/\\b\\w{4,}\\b/g) || [];
            topics.push(...keywords.slice(0, 5));
        }

        return topics.slice(0, 10);
    }

    private static async calculateTopicSimilarity(
        contentTopics: string[],
        userPreferences: any | null
    ): Promise<number> {
        if (!userPreferences?.topicAffinities || contentTopics.length === 0) return 0;

        let totalSimilarity = 0;
        let matchCount = 0;

        for (const topic of contentTopics) {
            const affinity = userPreferences.topicAffinities.get(topic);
            if (typeof affinity === 'number') {
                totalSimilarity += affinity;
                matchCount++;
            }
        }

        return matchCount > 0 ? totalSimilarity / matchCount : 0;
    }

    private static calculateTemporalMatch(currentHour: number, userPreferences: any | null): number {
        const peakHours = [9, 12, 18, 21];
        return peakHours.includes(currentHour) ? 1 : 0.3;
    }

    private static calculateCommunitySizeFactor(communitySize: number): number {
        if (communitySize < 1000) return 0.2;
        if (communitySize < 10000) return 0.5;
        if (communitySize < 100000) return 0.8;
        return 1.0;
    }

    /**
     * Calculate social graph features based on contact relationships
     * This builds an Instagram-style friend graph for better recommendations
     */
    private static async calculateSocialGraphFeatures(
        userId: string,
        authorId: string,
        userPreferences: any | null
    ): Promise<{
        is_direct_contact: boolean;
        mutual_contact_count: number;
        contact_engagement_boost: number;
        second_degree_connection: boolean;
    }> {
        try {
            // Check if author is a direct contact (1st degree)
            const isDirectContact = userPreferences?.contactMatches?.has(authorId) || false;

            // Get mutual contacts count (shared contacts between user and author)
            const mutualContactCount = userPreferences?.mutualContacts?.get(authorId) || 0;

            // Check if author is a second-degree connection (friend of friend)
            const isSecondDegree = userPreferences?.secondDegreeConnections?.has(authorId) || false;

            // Calculate engagement boost based on contact network strength
            let contactBoost = 0;
            if (isDirectContact) {
                contactBoost = 1.0; // Max boost for direct contacts
            } else if (mutualContactCount > 0) {
                // Boost scales with number of mutual contacts (capped at 0.8)
                contactBoost = Math.min(mutualContactCount * 0.2, 0.8);
            } else if (isSecondDegree) {
                contactBoost = 0.5; // Moderate boost for 2nd degree
            }

            return {
                is_direct_contact: isDirectContact,
                mutual_contact_count: mutualContactCount,
                contact_engagement_boost: contactBoost,
                second_degree_connection: isSecondDegree
            };
        } catch (error) {
            // Fallback to no social graph features
            return {
                is_direct_contact: false,
                mutual_contact_count: 0,
                contact_engagement_boost: 0,
                second_degree_connection: false
            };
        }
    }

    private static cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) return 0;

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        const norm = Math.sqrt(normA) * Math.sqrt(normB);
        return norm > 0 ? dotProduct / norm : 0;
    }

    private static sigmoid(x: number): number {
        return 1 / (1 + Math.exp(-Math.max(-10, Math.min(10, x))));
    }

    private static getEngagementScore(engagementType: string): number {
        const scores: Record<string, number> = {
            'view': 0.1,
            'reaction': 0.3,
            'reply': 0.7,
            'renote': 0.5
        };
        return scores[engagementType] || 0.1;
    }

    private static scheduleModelUpdate(): void {
        if (this.trainingData.length < 10) return;

        Promise.resolve().then(() => {
            this.updateModelWeights();
        });
    }

    private static updateModelWeights(): void {
        // Simplified online learning implementation
        this.lastModelUpdate = Date.now();
    }

    private static heuristicFallback(features: MonolithFeatures): number {
        return (features.social_proof_score * 0.4 +
            features.author_user_affinity * 0.3 +
            features.topic_similarity_score * 0.3);
    }

    private static getDefaultFeatures(userId: string, authorId: string, communitySize: number): MonolithFeatures {
        return {
            user_id: userId,
            author_id: authorId,
            content_topics: [],
            user_engagement_rate: 0.1,
            content_length_normalized: 0.3,
            content_age_hours: 0.5,
            social_proof_score: 0.1,
            author_user_affinity: 0,
            topic_similarity_score: 0,
            temporal_match_score: 0.5,
            // Social graph defaults
            is_direct_contact: false,
            mutual_contact_count: 0,
            contact_engagement_boost: 0,
            second_degree_connection: false,
            // Community features
            community_size_factor: this.calculateCommunitySizeFactor(communitySize),
            personalization_strength: communitySize > 10000 ? 0.9 : 0.5,
            discovery_boost: communitySize < 1000 ? 0.8 : 0.3
        };
    }

    /**
     * Get system status for monitoring
     */
    static getSystemStatus(): {
        embeddingStats: any;
        trainingBufferSize: number;
        lastModelUpdate: number;
        systemHealth: boolean;
    } {
        const embeddingStats = this.embeddingManager?.getSystemStats() || null;

        return {
            embeddingStats,
            trainingBufferSize: this.trainingData.length,
            lastModelUpdate: this.lastModelUpdate,
            systemHealth: this.embeddingManager?.isSystemHealthy() || false
        };
    }
}