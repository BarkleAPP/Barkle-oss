import { UserAlgorithmPreferences } from '@/models/index.js';

/**
 * Algorithm Learning Persistence Service
 * Saves and loads algorithm learnings to/from database
 */
export class AlgorithmLearningPersistence {
    /**
     * Save user preferences from in-memory algorithm to database
     */
    static async saveUserPreferences(
        userId: string,
        preferences: {
            topicAffinities?: Map<string, number> | Record<string, number>;
            authorAffinities?: Map<string, number> | Record<string, number>;
            engagementPatterns?: any;
            temporalPatterns?: any;
            contactMatches?: Set<string> | Record<string, any>;
            secondDegreeConnections?: Map<string, number> | Record<string, number>;
            userEmbedding?: number[];
            totalSignals?: number;
            engagementRate?: number;
        },
    ): Promise<void> {
        // Convert Maps/Sets to plain objects for JSON storage
        const topicAffinities = preferences.topicAffinities
            ? this.mapToObject(preferences.topicAffinities)
            : undefined;

        const authorAffinities = preferences.authorAffinities
            ? this.mapToObject(preferences.authorAffinities)
            : undefined;

        const contactMatches = preferences.contactMatches
            ? this.setOrMapToObject(preferences.contactMatches)
            : undefined;

        const secondDegreeConnections = preferences.secondDegreeConnections
            ? this.mapToObject(preferences.secondDegreeConnections)
            : undefined;

        await UserAlgorithmPreferences.updateLearnings(userId, {
            topicAffinities,
            authorAffinities,
            engagementPatterns: preferences.engagementPatterns,
            temporalPatterns: preferences.temporalPatterns,
            contactMatches,
            secondDegreeConnections,
            userEmbedding: preferences.userEmbedding,
            totalSignals: preferences.totalSignals,
            engagementRate: preferences.engagementRate,
        });
    }

    /**
     * Load user preferences from database to in-memory format
     */
    static async loadUserPreferences(userId: string): Promise<{
        topicAffinities: Map<string, number>;
        authorAffinities: Map<string, number>;
        engagementPatterns: any;
        temporalPatterns: any;
        contactMatches: Set<string>;
        secondDegreeConnections: Map<string, number>;
        userEmbedding: number[] | null;
        totalSignals: number;
        engagementRate: number;
    } | null> {
        const stored = await UserAlgorithmPreferences.findByUserId(userId);

        if (!stored) {
            return null;
        }

        return {
            topicAffinities: this.objectToMap(stored.topicAffinities),
            authorAffinities: this.objectToMap(stored.authorAffinities),
            engagementPatterns: stored.engagementPatterns,
            temporalPatterns: stored.temporalPatterns,
            contactMatches: this.objectToSet(stored.contactMatches),
            secondDegreeConnections: this.objectToMap(stored.secondDegreeConnections),
            userEmbedding: stored.userEmbedding,
            totalSignals: stored.totalSignals,
            engagementRate: stored.engagementRate,
        };
    }

    /**
     * Batch save multiple users' preferences (useful for periodic persistence)
     */
    static async batchSavePreferences(
        userPreferences: Map<
            string,
            {
                topicAffinities?: Map<string, number>;
                authorAffinities?: Map<string, number>;
                engagementPatterns?: any;
                totalSignals?: number;
                engagementRate?: number;
            }
        >,
    ): Promise<void> {
        const promises: Promise<void>[] = [];

        for (const [userId, prefs] of userPreferences.entries()) {
            promises.push(this.saveUserPreferences(userId, prefs));
        }

        await Promise.all(promises);
    }

    /**
     * Schedule periodic persistence of algorithm learnings
     */
    static startPeriodicPersistence(
        getUserPreferencesCallback: () => Map<string, any>,
        intervalMinutes = 5,
    ): NodeJS.Timeout {
        const intervalMs = intervalMinutes * 60 * 1000;

        return setInterval(async () => {
            try {
                const allPreferences = getUserPreferencesCallback();
                await this.batchSavePreferences(allPreferences);
                console.log(
                    `[AlgorithmPersistence] Saved ${allPreferences.size} user preferences`,
                );
            } catch (error) {
                console.error('[AlgorithmPersistence] Failed to save preferences:', error);
            }
        }, intervalMs);
    }

    /**
     * Get persistence statistics
     */
    static async getStats(): Promise<{
        totalUsers: number;
        averageSignals: number;
        averageEngagementRate: number;
        recentlyUpdated: number;
    }> {
        const allPrefs = await UserAlgorithmPreferences.find();

        const totalUsers = allPrefs.length;
        const averageSignals =
            allPrefs.reduce((sum, p) => sum + p.totalSignals, 0) / (totalUsers || 1);
        const averageEngagementRate =
            allPrefs.reduce((sum, p) => sum + p.engagementRate, 0) / (totalUsers || 1);

        // Count recently updated (last 24 hours)
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);

        const recentlyUpdated = allPrefs.filter(
            p => p.lastLearningUpdate && p.lastLearningUpdate > oneDayAgo,
        ).length;

        return {
            totalUsers,
            averageSignals,
            averageEngagementRate,
            recentlyUpdated,
        };
    }

    // Helper methods
    private static mapToObject<V>(map: Map<string, V> | Record<string, V>): Record<string, V> {
        if (map instanceof Map) {
            return Object.fromEntries(map.entries());
        }
        return map;
    }

    private static objectToMap<V>(obj: Record<string, V>): Map<string, V> {
        return new Map(Object.entries(obj));
    }

    private static setOrMapToObject(
        setOrMap: Set<string> | Map<string, any> | Record<string, any>,
    ): Record<string, any> {
        if (setOrMap instanceof Set) {
            return Object.fromEntries([...setOrMap].map(key => [key, true]));
        } else if (setOrMap instanceof Map) {
            return Object.fromEntries(setOrMap.entries());
        }
        return setOrMap;
    }

    private static objectToSet(obj: Record<string, any>): Set<string> {
        return new Set(Object.keys(obj));
    }
}
