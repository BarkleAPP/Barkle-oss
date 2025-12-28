/**
 * Signal to Preference Adapter
 * Bridges UserSignalTracker with MonolithInspiredRanker
 * Converts raw signals into structured preferences for per-user recommendations
 */

import { UserSignalTracker, UserPreferences } from '../tracking/user-signal-tracker.js';
import { MonolithInspiredRanker } from '../ranker/monolith-inspired-ranker.js';

export interface AdaptedUserPreferences {
    userId: string;
    engagementPatterns: {
        engagementRate: number;
        averageDwellTime: number;
        preferredTimeOfDay: number[];
        diversityTolerance: number;
    };
    authorAffinities: Map<string, number>;
    topicAffinities: Map<string, number>;
    contentTypePreferences: Map<string, number>;
    negativeSignals: {
        blockedAuthors: Set<string>;
        mutedTopics: Set<string>;
        reportedContent: Set<string>;
    };
}

export class SignalToPreferenceAdapter {
    /**
     * Convert UserSignalTracker preferences to format used by ranker
     */
    static async getUserPreferencesForRanking(userId: string): Promise<AdaptedUserPreferences | null> {
        const rawPreferences = await UserSignalTracker.getUserPreferences(userId);

        if (!rawPreferences) {
            return null;
        }

        return {
            userId: rawPreferences.userId,
            engagementPatterns: rawPreferences.engagementPatterns,
            authorAffinities: rawPreferences.authorAffinities,
            topicAffinities: rawPreferences.topicAffinities,
            contentTypePreferences: rawPreferences.contentTypePreferences,
            negativeSignals: rawPreferences.negativeSignals
        };
    }

    /**
     * Check if content should be filtered based on user's negative signals
     */
    static async shouldFilterContent(
        userId: string,
        authorId: string,
        contentTopics: string[]
    ): Promise<boolean> {
        const negativeSignals = await UserSignalTracker.getUserNegativeSignals(userId);

        // Block if author is blocked
        if (negativeSignals.blockedAuthors.has(authorId)) {
            return true;
        }

        // Filter if any topic is muted
        for (const topic of contentTopics) {
            if (negativeSignals.mutedTopics.has(topic)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get personalized ranking score boost based on user signals
     */
    static async getPersonalizedBoost(
        userId: string,
        authorId: string,
        contentTopics: string[]
    ): Promise<number> {
        const preferences = await this.getUserPreferencesForRanking(userId);

        if (!preferences) {
            return 0; // Neutral boost
        }

        let boost = 0;

        // Author affinity boost (strongest signal)
        const authorAffinity = preferences.authorAffinities.get(authorId) || 0.5;
        boost += (authorAffinity - 0.5) * 0.4; // -0.2 to +0.2

        // Topic affinity boost
        let topicBoost = 0;
        let topicCount = 0;
        for (const topic of contentTopics) {
            const topicAffinity = preferences.topicAffinities.get(topic);
            if (topicAffinity !== undefined) {
                topicBoost += topicAffinity;
                topicCount++;
            }
        }
        if (topicCount > 0) {
            const avgTopicAffinity = topicBoost / topicCount;
            boost += (avgTopicAffinity - 0.5) * 0.3; // -0.15 to +0.15
        }

        // Diversity tolerance factor
        const diversityBoost = preferences.engagementPatterns.diversityTolerance * 0.1;
        boost += diversityBoost;

        return Math.max(-0.5, Math.min(0.5, boost)); // Clamp to [-0.5, 0.5]
    }

    /**
     * Update embeddings based on user interaction
     */
    static async updateEmbeddingsFromSignal(
        userId: string,
        authorId: string,
        contentTopics: string[],
        signalStrength: number
    ): Promise<void> {
        // Update embedding frequencies for frequently engaged content
        if (signalStrength > 0.7) {
            MonolithInspiredRanker.updateEmbeddingFrequency('user', userId);
            MonolithInspiredRanker.updateEmbeddingFrequency('author', authorId);

            for (const topic of contentTopics) {
                MonolithInspiredRanker.updateEmbeddingFrequency('topic', topic);
            }
        }
    }

    /**
     * Get engagement prediction for content using user signals
     */
    static async predictEngagementWithSignals(
        noteData: {
            id: string;
            text?: string;
            tags?: string[];
            fileIds?: string[];
            userId: string;
            createdAt: Date;
        },
        userId: string,
        communitySize: number
    ): Promise<{ score: number; reasons: string[] }> {
        // Get user preferences from signals
        const userPreferences = await this.getUserPreferencesForRanking(userId);

        // Extract features
        const features = await MonolithInspiredRanker.extractFeatures(
            noteData,
            userId,
            userPreferences,
            communitySize
        );

        // Check if should be filtered
        const shouldFilter = await this.shouldFilterContent(
            userId,
            noteData.userId,
            features.content_topics
        );

        if (shouldFilter) {
            return {
                score: 0,
                reasons: ['Filtered by user preferences']
            };
        }

        // Get base prediction
        const baseScore = await MonolithInspiredRanker.predictEngagement(features);

        // Apply personalized boost
        const personalizedBoost = await this.getPersonalizedBoost(
            userId,
            noteData.userId,
            features.content_topics
        );

        const finalScore = Math.max(0, Math.min(1, baseScore + personalizedBoost));

        // Generate reasons
        const reasons: string[] = [];
        if (personalizedBoost > 0.1) {
            reasons.push('Based on your interests');
        }
        if (features.author_user_affinity > 0.7) {
            reasons.push('From someone you engage with often');
        }
        if (features.temporal_match_score > 0.7) {
            reasons.push('Posted at your preferred time');
        }
        if (features.discovery_boost > 0.5) {
            reasons.push('Discover new content');
        }

        return {
            score: finalScore,
            reasons
        };
    }

    /**
     * Batch predict engagement for multiple notes
     */
    static async batchPredictEngagement(
        notes: Array<{
            id: string;
            text?: string;
            tags?: string[];
            fileIds?: string[];
            userId: string;
            createdAt: Date;
        }>,
        userId: string,
        communitySize: number
    ): Promise<Array<{ noteId: string; score: number; reasons: string[] }>> {
        const results: Array<{ noteId: string; score: number; reasons: string[] }> = [];

        for (const note of notes) {
            const prediction = await this.predictEngagementWithSignals(note, userId, communitySize);
            results.push({
                noteId: note.id,
                score: prediction.score,
                reasons: prediction.reasons
            });
        }

        return results;
    }

    /**
     * Get recommendation statistics for debugging
     */
    static async getRecommendationStats(userId: string): Promise<{
        totalSignals: number;
        authorAffinities: number;
        topicAffinities: number;
        blockedAuthors: number;
        mutedTopics: number;
        engagementRate: number;
        diversityTolerance: number;
    }> {
        const preferences = await this.getUserPreferencesForRanking(userId);

        if (!preferences) {
            return {
                totalSignals: 0,
                authorAffinities: 0,
                topicAffinities: 0,
                blockedAuthors: 0,
                mutedTopics: 0,
                engagementRate: 0,
                diversityTolerance: 0
            };
        }

        return {
            totalSignals: 0, // Would need to track this separately
            authorAffinities: preferences.authorAffinities.size,
            topicAffinities: preferences.topicAffinities.size,
            blockedAuthors: preferences.negativeSignals.blockedAuthors.size,
            mutedTopics: preferences.negativeSignals.mutedTopics.size,
            engagementRate: preferences.engagementPatterns.engagementRate,
            diversityTolerance: preferences.engagementPatterns.diversityTolerance
        };
    }
}
