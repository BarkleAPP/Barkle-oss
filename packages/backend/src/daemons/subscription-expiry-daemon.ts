import { SubscriptionManagerComprehensive } from '@/services/subscription-manager.js';
import Logger from '@/services/logger.js';

const logger = new Logger('subscriptionExpiryDaemon');

/**
 * Daemon to automatically clean up expired subscriptions
 * Runs every hour to check for and remove expired Barkle+/Mini+ access
 */
export class SubscriptionExpiryDaemon {
    private static interval: NodeJS.Timeout | null = null;
    private static readonly CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds

    /**
     * Start the subscription expiry daemon
     */
    public static start(): void {
        if (this.interval) {
            logger.warn('Subscription expiry daemon is already running');
            return;
        }

        logger.info('Starting subscription expiry daemon (checks every hour)');

        // Run immediately on start
        this.checkExpiredSubscriptions();

        // Then run every hour
        this.interval = setInterval(() => {
            this.checkExpiredSubscriptions();
        }, this.CHECK_INTERVAL);
    }

    /**
     * Stop the subscription expiry daemon
     */
    public static stop(): void {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
            logger.info('Subscription expiry daemon stopped');
        }
    }

    /**
     * Check for and clean up expired subscriptions
     */
    private static async checkExpiredSubscriptions(): Promise<void> {
        try {
            console.log('🔧 EXPIRY DAEMON: Checking for expired subscriptions...');

            const cleanedCount = await SubscriptionManagerComprehensive.cleanupExpiredSubscriptions();

            if (cleanedCount > 0) {
                console.log(`🔧 EXPIRY DAEMON: Cleaned up ${cleanedCount} expired subscriptions`);
                logger.info(`Cleaned up ${cleanedCount} expired subscriptions`);
            } else {
                console.log('🔧 EXPIRY DAEMON: No expired subscriptions found');
            }

        } catch (error) {
            console.error('❌ EXPIRY DAEMON ERROR: Failed to check expired subscriptions:', error);
            logger.error('Subscription expiry daemon error:', error as Error);
        }
    }

    /**
     * Manual trigger for testing
     */
    public static async runManualCheck(): Promise<number> {
        console.log('🔧 EXPIRY DAEMON: Running manual expiry check...');
        try {
            const cleanedCount = await SubscriptionManagerComprehensive.cleanupExpiredSubscriptions();
            console.log(`🔧 EXPIRY DAEMON: Manual check completed, cleaned ${cleanedCount} subscriptions`);
            return cleanedCount;
        } catch (error) {
            console.error('❌ EXPIRY DAEMON ERROR: Manual check failed:', error);
            throw error;
        }
    }
}