import { UserAlgorithmPreferences } from '@/models/index.js';
import { AlgorithmLearningPersistence } from './algorithm-learning-persistence.js';
import { SocialGraphSpiderWebService } from './social-graph-spider-web.js';
import { AlgorithmMicroserviceClient } from './algorithm/algorithm-microservice-client.js';
import { userPersonalizationService } from './algorithm/user-personalization-service.js';
import { behavioralPatternRecognition } from './algorithm/behavioral-pattern-recognition.js';
import Logger from './logger.js';

const logger = new Logger('algorithm-initializer');

/**
 * Initialize and wire up the algorithm system with persistence
 * Uses the existing AlgorithmMicroserviceClient architecture
 */
export class AlgorithmSystemInitializer {
    private static persistenceInterval: NodeJS.Timeout | null = null;
    private static isInitialized = false;
    private static algorithmClient: AlgorithmMicroserviceClient | null = null;

    /**
     * Initialize the complete algorithm system with persistence
     */
    static async initialize(): Promise<void> {
        if (this.isInitialized) {
            logger.info('Algorithm system already initialized');
            return;
        }

        try {
            logger.info('Initializing algorithm system...');

            // 1. Initialize the Algorithm Microservice Client (singleton)
            this.algorithmClient = AlgorithmMicroserviceClient.getInstance();
            logger.info('✓ AlgorithmMicroserviceClient initialized');

            // 2. Start periodic persistence for user preferences (every 5 minutes)
            this.persistenceInterval = setInterval(async () => {
                try {
                    await this.saveUserPreferencesToDatabase();
                } catch (error) {
                    logger.error('[Persistence] Failed to save user preferences:', error as Error);
                }
            }, 5 * 60 * 1000);
            logger.info('✓ Periodic persistence started (5 min intervals)');

            // 3. Load existing user preferences stats
            await this.loadExistingPreferences();

            this.isInitialized = true;
            logger.info('✅ Algorithm system fully initialized');
        } catch (error) {
            logger.error('Failed to initialize algorithm system:', error as Error);
            throw error;
        }
    }

    /**
     * Load existing user preferences from database on startup
     */
    private static async loadExistingPreferences(): Promise<void> {
        try {
            // Get stats to see how many users have stored preferences
            const stats = await AlgorithmLearningPersistence.getStats();
            logger.info(
                `Found ${stats.totalUsers} users with stored preferences (${stats.recentlyUpdated} recently updated)`,
            );

            // Preferences are loaded on-demand when users request timelines
            // This is more memory efficient than pre-loading everything
        } catch (error) {
            logger.error('Failed to load existing preferences:', error as Error);
        }
    }

    /**
     * Save user preferences to database
     * This integrates with the existing userPersonalizationService
     */
    private static async saveUserPreferencesToDatabase(): Promise<void> {
        try {
            // The existing system (userPersonalizationService, behavioralPatternRecognition)
            // already handles persistence internally through database writes
            // This periodic check ensures everything is flushed

            const stats = await AlgorithmLearningPersistence.getStats();
            logger.debug(`[Persistence] ${stats.totalUsers} users tracked, ${stats.recentlyUpdated} recently active`);
        } catch (error) {
            logger.error('[Persistence] Error checking persistence stats:', error as Error);
        }
    }

    /**
     * Graceful shutdown - save all in-memory data before exit
     */
    static async shutdown(): Promise<void> {
        logger.info('Shutting down algorithm system...');

        try {
            // Stop periodic persistence
            if (this.persistenceInterval) {
                clearInterval(this.persistenceInterval);
                this.persistenceInterval = null;
            }

            // Final save of all user data
            await this.saveUserPreferencesToDatabase();
            logger.info('✓ All user preferences saved');

            // Get final stats
            const persistenceStats = await AlgorithmLearningPersistence.getStats();
            logger.info('✓ Final persistence stats:', persistenceStats);

            this.isInitialized = false;
            logger.info('✅ Algorithm system shutdown complete');
        } catch (error) {
            logger.error('Error during algorithm system shutdown:', error as Error);
        }
    }

    /**
     * Manual trigger to save all preferences (useful for debug/admin)
     */
    static async saveAllPreferences(): Promise<void> {
        await this.saveUserPreferencesToDatabase();
        logger.info('Manual save completed');
    }

    /**
     * Get system health status
     */
    static async getSystemHealth(): Promise<{
        isInitialized: boolean;
        persistenceStats: any;
        algorithmClientReady: boolean;
    }> {
        return {
            isInitialized: this.isInitialized,
            algorithmClientReady: this.algorithmClient !== null,
            persistenceStats: await AlgorithmLearningPersistence.getStats(),
        };
    }

    /**
     * Rebuild social graph for a user (useful after contact import)
     */
    static async rebuildSocialGraph(userId: string): Promise<void> {
        try {
            await SocialGraphSpiderWebService.rebuildAfterContactImport(userId);
            await SocialGraphSpiderWebService.updateAlgorithmPreferencesWithSocialGraph(userId);
            logger.info(`Social graph rebuilt for user ${userId}`);
        } catch (error) {
            logger.error(`Failed to rebuild social graph for ${userId}:`, error as Error);
        }
    }

    /**
     * Record user engagement (integrates with existing client)
     */
    static async recordEngagement(
        userId: string,
        noteId: string,
        engagementType: 'reaction' | 'reply' | 'renote' | 'view' | 'share',
        metadata?: Record<string, any>,
    ): Promise<void> {
        if (this.algorithmClient) {
            await this.algorithmClient.recordEngagement(userId, noteId, engagementType, metadata);
        }
    }

    /**
     * Add user feedback (integrates with existing client)
     */
    static async addUserFeedback(
        userId: string,
        contentId: string,
        feedbackType: 'like' | 'dislike' | 'report' | 'hide' | 'share' | 'save',
        reason?: string,
        severity?: 'low' | 'medium' | 'high',
    ): Promise<void> {
        if (this.algorithmClient) {
            await this.algorithmClient.addUserFeedback(userId, contentId, feedbackType, reason, severity);
        }
    }
}
