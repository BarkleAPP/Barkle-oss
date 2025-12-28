/**
 * Active Users Service
 * Provides real-time active user metrics for scaling trending algorithms
 */

import { Users } from '@/models/index.js';
import { MoreThan } from 'typeorm';
import { Cache } from '@/misc/cache.js';

const HOUR = 1000 * 60 * 60;
const DAY = 1000 * 60 * 60 * 24;
const WEEK = 1000 * 60 * 60 * 24 * 7;

interface ActiveUserMetrics {
    activeUsersLast1h: number;
    activeUsersLast6h: number;
    activeUsersLast24h: number;
    activeUsersLast7d: number;
    totalUsers: number;
    timestamp: Date;
}

export class ActiveUsersService {
    private static cache = new Cache<ActiveUserMetrics>('active-users-metrics', 5 * 60 * 1000); // 5 minute cache

    /**
     * Get active user counts for different time periods
     */
    public static async getActiveUserMetrics(): Promise<ActiveUserMetrics> {
        // Check cache first
        const cached = this.cache.get('metrics');
        if (cached) {
            return cached;
        }

        // Calculate metrics
        const now = Date.now();

        const [
            activeUsersLast1h,
            activeUsersLast6h,
            activeUsersLast24h,
            activeUsersLast7d,
            totalUsers
        ] = await Promise.all([
            Users.count({
                where: {
                    host: null, // Local users only
                    lastActiveDate: MoreThan(new Date(now - HOUR)),
                },
            }),
            Users.count({
                where: {
                    host: null,
                    lastActiveDate: MoreThan(new Date(now - (6 * HOUR))),
                },
            }),
            Users.count({
                where: {
                    host: null,
                    lastActiveDate: MoreThan(new Date(now - DAY)),
                },
            }),
            Users.count({
                where: {
                    host: null,
                    lastActiveDate: MoreThan(new Date(now - WEEK)),
                },
            }),
            Users.count({
                where: {
                    host: null,
                },
            })
        ]);

        const metrics: ActiveUserMetrics = {
            activeUsersLast1h,
            activeUsersLast6h,
            activeUsersLast24h,
            activeUsersLast7d,
            totalUsers,
            timestamp: new Date(),
        };

        // Cache the result
        this.cache.set('metrics', metrics);

        return metrics;
    }

    /**
     * Get scaling factor for trending algorithms based on active user count
     * Returns a multiplier to adjust trending thresholds
     */
    public static async getTrendingScalingFactor(): Promise<number> {
        const metrics = await this.getActiveUserMetrics();

        // Base the scaling on 6-hour active users (good balance of recency and volume)
        const activeUsers = metrics.activeUsersLast6h;

        // Define reference points for scaling
        // - Small instance: 10-50 active users = 1x scaling
        // - Medium instance: 100-500 active users = 2-5x scaling  
        // - Large instance: 1000+ active users = 10x+ scaling

        if (activeUsers <= 10) {
            // Very small instance - use minimal thresholds
            return 0.3;
        } else if (activeUsers <= 50) {
            // Small instance - baseline
            return 1.0;
        } else if (activeUsers <= 100) {
            // Growing instance
            return 1.5;
        } else if (activeUsers <= 250) {
            // Medium instance
            return 2.5;
        } else if (activeUsers <= 500) {
            // Large instance
            return 4.0;
        } else if (activeUsers <= 1000) {
            // Very large instance
            return 7.0;
        } else {
            // Massive instance - scale logarithmically beyond this point
            return 7.0 + Math.log10(activeUsers / 1000) * 3;
        }
    }

    /**
     * Get dynamic trending thresholds based on active users
     */
    public static async getDynamicTrendingThresholds() {
        const scalingFactor = await this.getTrendingScalingFactor();
        const metrics = await this.getActiveUserMetrics();

        // Calculate what percentage of active users needs to engage for trending
        const engagementThreshold = Math.max(3, Math.ceil(metrics.activeUsersLast6h * 0.02)); // 2% of active users, min 3
        const viralThreshold = Math.max(5, Math.ceil(metrics.activeUsersLast6h * 0.05)); // 5% of active users, min 5

        return {
            // Minimum engagement velocity (engagements per hour) to be considered trending
            minVelocity: 2 * scalingFactor,

            // Minimum total engagement for trending status
            minEngagement: engagementThreshold,

            // Threshold for "hot" status (very rapid engagement)
            hotThreshold: viralThreshold,

            // Engagement rate threshold (engagements per hour)
            engagementRateThreshold: 5 * scalingFactor,

            // Recent activity boost threshold
            recentBoostThreshold: 3 * scalingFactor,

            // Scaling factor for all calculations
            scalingFactor,

            // Active user context
            activeUsers: metrics.activeUsersLast6h,
            totalUsers: metrics.totalUsers,
        };
    }

    /**
     * Calculate normalized trending score that scales with active users
     */
    public static async calculateScaledTrendingScore(rawMetrics: {
        totalEngagement: number;
        velocity: number; // engagements per hour
        ageInHours: number;
        recentEngagement: number; // last 6 hours
    }): Promise<number> {
        const thresholds = await this.getDynamicTrendingThresholds();

        // Normalize velocity against active user base
        const normalizedVelocity = (rawMetrics.velocity / thresholds.minVelocity) * 10;

        // Normalize recent engagement against active users
        const normalizedRecent = (rawMetrics.recentEngagement / thresholds.recentBoostThreshold) * 20;

        // Time decay factor (favor recent content)
        const timeFactor = Math.max(0.1, 1 - (rawMetrics.ageInHours / 48));

        // Calculate final score
        const score = (normalizedVelocity * 0.6 + normalizedRecent * 0.4) * timeFactor;

        return Math.round(score);
    }

    /**
     * Determine if content is trending based on scaled metrics
     */
    public static async isTrending(metrics: {
        totalEngagement: number;
        velocity: number;
        ageInHours: number;
        recentEngagement: number;
    }): Promise<boolean> {
        const thresholds = await this.getDynamicTrendingThresholds();

        // Content is trending if:
        // 1. Velocity exceeds minimum threshold
        // 2. Has minimum engagement
        // 3. Is relatively recent (less than 48 hours old)
        return (
            metrics.velocity >= thresholds.minVelocity &&
            metrics.totalEngagement >= thresholds.minEngagement &&
            metrics.ageInHours < 48
        );
    }

    /**
     * Determine if content is "hot" (viral trending)
     */
    public static async isHot(metrics: {
        totalEngagement: number;
        velocity: number;
        ageInHours: number;
        recentEngagement: number;
    }): Promise<boolean> {
        const thresholds = await this.getDynamicTrendingThresholds();

        // Content is hot if:
        // 1. Very high velocity
        // 2. Recent content (less than 6 hours)
        // 3. High recent engagement
        return (
            metrics.velocity >= thresholds.engagementRateThreshold &&
            metrics.ageInHours < 6 &&
            metrics.recentEngagement >= thresholds.hotThreshold
        );
    }
}
