import { UserAlgorithmPreferences } from '../entities/user-algorithm-preferences.js';
import { db } from '@/db/postgre.js';
import { genId } from '@/misc/gen-id.js';

export const UserAlgorithmPreferencesRepository = db.getRepository(UserAlgorithmPreferences).extend({
    async findByUserId(userId: string): Promise<UserAlgorithmPreferences | null> {
        return this.findOne({
            where: { userId },
        });
    },

    async getOrCreate(userId: string): Promise<UserAlgorithmPreferences> {
        let preferences = await this.findByUserId(userId);

        if (!preferences) {
            preferences = this.create({
                id: genId(),
                userId,
                topicAffinities: {},
                authorAffinities: {},
                engagementPatterns: {},
                temporalPatterns: {},
                contactMatches: {},
                secondDegreeConnections: {},
                userEmbedding: null,
                modelVersion: 1,
                totalSignals: 0,
                engagementRate: 0,
                lastLearningUpdate: null,
            });

            await this.save(preferences);
        }

        return preferences;
    },

    async updateLearnings(
        userId: string,
        learnings: {
            topicAffinities?: Record<string, number>;
            authorAffinities?: Record<string, number>;
            engagementPatterns?: Record<string, any>;
            temporalPatterns?: Record<string, any>;
            contactMatches?: Record<string, any>;
            secondDegreeConnections?: Record<string, number>;
            userEmbedding?: number[];
            totalSignals?: number;
            engagementRate?: number;
        },
    ): Promise<void> {
        const preferences = await this.getOrCreate(userId);

        // Merge learnings with existing data
        if (learnings.topicAffinities) {
            preferences.topicAffinities = {
                ...preferences.topicAffinities,
                ...learnings.topicAffinities,
            };
        }

        if (learnings.authorAffinities) {
            preferences.authorAffinities = {
                ...preferences.authorAffinities,
                ...learnings.authorAffinities,
            };
        }

        if (learnings.engagementPatterns) {
            preferences.engagementPatterns = {
                ...preferences.engagementPatterns,
                ...learnings.engagementPatterns,
            };
        }

        if (learnings.temporalPatterns) {
            preferences.temporalPatterns = {
                ...preferences.temporalPatterns,
                ...learnings.temporalPatterns,
            };
        }

        if (learnings.contactMatches) {
            preferences.contactMatches = {
                ...preferences.contactMatches,
                ...learnings.contactMatches,
            };
        }

        if (learnings.secondDegreeConnections) {
            preferences.secondDegreeConnections = {
                ...preferences.secondDegreeConnections,
                ...learnings.secondDegreeConnections,
            };
        }

        if (learnings.userEmbedding) {
            preferences.userEmbedding = learnings.userEmbedding;
        }

        if (learnings.totalSignals !== undefined) {
            preferences.totalSignals = learnings.totalSignals;
        }

        if (learnings.engagementRate !== undefined) {
            preferences.engagementRate = learnings.engagementRate;
        }

        preferences.lastLearningUpdate = new Date();

        await this.save(preferences);
    },

    async incrementSignalCount(userId: string): Promise<void> {
        await this.createQueryBuilder()
            .update(UserAlgorithmPreferences)
            .set({
                totalSignals: () => '"totalSignals" + 1',
            })
            .where('userId = :userId', { userId })
            .execute();
    },

    async clearLearnings(userId: string): Promise<void> {
        await this.update({ userId }, {
            topicAffinities: {},
            authorAffinities: {},
            engagementPatterns: {},
            temporalPatterns: {},
            contactMatches: {},
            secondDegreeConnections: {},
            userEmbedding: null,
            totalSignals: 0,
            engagementRate: 0,
            lastLearningUpdate: new Date(),
        });
    },
});
