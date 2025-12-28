/**
 * User Category Preferences Service
 * Tracks what categories users engage with most and learns their preferences
 */

import { Notes, Users } from '@/models/index.js';
import { User } from '@/models/entities/user.js';
import { Note } from '@/models/entities/note.js';
import Logger from '@/services/logger.js';

const logger = new Logger('user-category-preferences');

export interface CategoryPreference {
    category: string;
    engagementScore: number;
    viewCount: number;
    likeCount: number;
    shareCount: number;
    replyCount: number;
    lastEngagement: Date;
    confidence: number; // How confident we are about this preference (0-1)
}

export interface UserCategoryProfile {
    userId: string;
    preferences: CategoryPreference[];
    topCategories: string[];
    diversityScore: number; // How diverse their interests are (0-1)
    lastUpdated: Date;
}

export class UserCategoryPreferencesService {
    private static instance: UserCategoryPreferencesService;
    private cache = new Map<string, UserCategoryProfile>();
    private readonly CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

    private constructor() { }

    public static getInstance(): UserCategoryPreferencesService {
        if (!UserCategoryPreferencesService.instance) {
            UserCategoryPreferencesService.instance = new UserCategoryPreferencesService();
        }
        return UserCategoryPreferencesService.instance;
    }

    /**
     * Track user engagement with a categorized note
     */
    public async trackEngagement(
        userId: string,
        noteId: string,
        category: string | null,
        engagementType: 'view' | 'like' | 'share' | 'reply' | 'click',
        weight: number = 1
    ): Promise<void> {
        if (!category || category === 'general') return;

        try {
            const profile = await this.getUserCategoryProfile(userId);

            // Find or create category preference
            let preference = profile.preferences.find(p => p.category === category);
            if (!preference) {
                preference = {
                    category,
                    engagementScore: 0,
                    viewCount: 0,
                    likeCount: 0,
                    shareCount: 0,
                    replyCount: 0,
                    lastEngagement: new Date(),
                    confidence: 0.1
                };
                profile.preferences.push(preference);
            }

            // Update engagement metrics
            switch (engagementType) {
                case 'view':
                    preference.viewCount++;
                    preference.engagementScore += 1 * weight;
                    break;
                case 'like':
                    preference.likeCount++;
                    preference.engagementScore += 3 * weight;
                    break;
                case 'share':
                    preference.shareCount++;
                    preference.engagementScore += 5 * weight;
                    break;
                case 'reply':
                    preference.replyCount++;
                    preference.engagementScore += 4 * weight;
                    break;
                case 'click':
                    preference.engagementScore += 2 * weight;
                    break;
            }

            preference.lastEngagement = new Date();

            // Update confidence based on total engagements
            const totalEngagements = preference.viewCount + preference.likeCount +
                preference.shareCount + preference.replyCount;
            preference.confidence = Math.min(totalEngagements / 50, 1); // Max confidence at 50 engagements

            // Recalculate profile metrics
            await this.updateProfileMetrics(profile);

            // Cache the updated profile
            this.cache.set(userId, profile);

            logger.debug(`Tracked ${engagementType} for user ${userId} in category ${category}`);
        } catch (error) {
            logger.error('Failed to track category engagement:', error as any);
        }
    }

    /**
     * Get user's category profile with preferences
     */
    public async getUserCategoryProfile(userId: string): Promise<UserCategoryProfile> {
        // Check cache first
        const cached = this.cache.get(userId);
        if (cached && (Date.now() - cached.lastUpdated.getTime()) < this.CACHE_TTL_MS) {
            return cached;
        }

        try {
            // Build profile from user's engagement history
            const profile = await this.buildProfileFromHistory(userId);

            // Cache the profile
            this.cache.set(userId, profile);

            return profile;
        } catch (error) {
            logger.error('Failed to get user category profile:', error as any);

            // Return default profile
            return {
                userId,
                preferences: [],
                topCategories: [],
                diversityScore: 0.5,
                lastUpdated: new Date()
            };
        }
    }

    /**
     * Get user's top preferred categories
     */
    public async getTopCategories(userId: string, limit: number = 5): Promise<string[]> {
        const profile = await this.getUserCategoryProfile(userId);
        return profile.topCategories.slice(0, limit);
    }

    /**
     * Get category preference score for a user
     */
    public async getCategoryScore(userId: string, category: string): Promise<number> {
        const profile = await this.getUserCategoryProfile(userId);
        const preference = profile.preferences.find(p => p.category === category);

        if (!preference) return 0;

        // Normalize score based on user's overall engagement
        const maxScore = Math.max(...profile.preferences.map(p => p.engagementScore));
        return maxScore > 0 ? preference.engagementScore / maxScore : 0;
    }

    /**
     * Build user profile from their engagement history
     */
    private async buildProfileFromHistory(userId: string): Promise<UserCategoryProfile> {
        // Get user's recent interactions with categorized notes
        const recentNotes = await Notes.createQueryBuilder('note')
            .where('note.userId = :userId OR note.id IN (SELECT noteId FROM note_reaction WHERE userId = :userId)', { userId })
            .andWhere('note.category IS NOT NULL')
            .andWhere('note.createdAt > :cutoff', { cutoff: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }) // Last 30 days
            .select(['note.id', 'note.category', 'note.createdAt', 'note.userId'])
            .orderBy('note.createdAt', 'DESC')
            .limit(500)
            .getMany();

        const categoryMap = new Map<string, CategoryPreference>();

        // Process each note interaction
        for (const note of recentNotes) {
            if (!note.category) continue;

            let preference = categoryMap.get(note.category);
            if (!preference) {
                preference = {
                    category: note.category,
                    engagementScore: 0,
                    viewCount: 0,
                    likeCount: 0,
                    shareCount: 0,
                    replyCount: 0,
                    lastEngagement: note.createdAt,
                    confidence: 0
                };
                categoryMap.set(note.category, preference);
            }

            // Weight based on recency (more recent = higher weight)
            const ageHours = (Date.now() - note.createdAt.getTime()) / (1000 * 60 * 60);
            const recencyWeight = Math.exp(-ageHours / 168); // Decay over 7 days

            if (note.userId === userId) {
                // User created content in this category
                preference.engagementScore += 10 * recencyWeight;
            } else {
                // User interacted with content in this category
                preference.viewCount++;
                preference.engagementScore += 2 * recencyWeight;
            }

            preference.lastEngagement = new Date(Math.max(
                preference.lastEngagement.getTime(),
                note.createdAt.getTime()
            ));
        }

        const preferences = Array.from(categoryMap.values());

        // Calculate confidence for each preference
        preferences.forEach(pref => {
            const totalEngagements = pref.viewCount + pref.likeCount + pref.shareCount + pref.replyCount;
            pref.confidence = Math.min(totalEngagements / 20, 1);
        });

        const profile: UserCategoryProfile = {
            userId,
            preferences,
            topCategories: [],
            diversityScore: 0,
            lastUpdated: new Date()
        };

        await this.updateProfileMetrics(profile);

        return profile;
    }

    /**
     * Update profile-level metrics
     */
    private async updateProfileMetrics(profile: UserCategoryProfile): Promise<void> {
        // Sort preferences by engagement score
        profile.preferences.sort((a, b) => b.engagementScore - a.engagementScore);

        // Update top categories
        profile.topCategories = profile.preferences
            .filter(p => p.confidence > 0.2) // Only confident preferences
            .slice(0, 10)
            .map(p => p.category);

        // Calculate diversity score (how spread out their interests are)
        if (profile.preferences.length > 0) {
            const totalScore = profile.preferences.reduce((sum, p) => sum + p.engagementScore, 0);
            const entropy = profile.preferences.reduce((sum, p) => {
                const probability = p.engagementScore / totalScore;
                return sum - (probability * Math.log2(probability));
            }, 0);

            // Normalize entropy to 0-1 scale
            const maxEntropy = Math.log2(profile.preferences.length);
            profile.diversityScore = maxEntropy > 0 ? entropy / maxEntropy : 0;
        } else {
            profile.diversityScore = 0.5; // Default diversity
        }

        profile.lastUpdated = new Date();
    }

    /**
     * Get personalized category weights for timeline ranking
     */
    public async getPersonalizedCategoryWeights(userId: string): Promise<Record<string, number>> {
        const profile = await this.getUserCategoryProfile(userId);
        const weights: Record<string, number> = {};

        // Convert preferences to weights (0-1 scale)
        const maxScore = Math.max(...profile.preferences.map(p => p.engagementScore), 1);

        for (const preference of profile.preferences) {
            if (preference.confidence > 0.1) {
                weights[preference.category] = (preference.engagementScore / maxScore) * preference.confidence;
            }
        }

        return weights;
    }

    /**
     * Clear cache for a user (useful after major preference changes)
     */
    public clearUserCache(userId: string): void {
        this.cache.delete(userId);
    }

    /**
     * Clear all caches
     */
    public clearAllCaches(): void {
        this.cache.clear();
    }
}

export const userCategoryPreferencesService = UserCategoryPreferencesService.getInstance();