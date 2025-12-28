import Bull from 'bull';
import Logger from '@/services/logger.js';
import { Users } from '@/models/index.js';
import { SubscriptionJobData } from '@/queue/types.js';
import { User } from '@/models/entities/user.js';
import { SubscriptionManager } from '@/services/subscription-manager.js';

const logger = new Logger('subscriptionProcessor');

/**
 * Process subscription-related jobs
 */
export async function processSubscription(job: Bull.Job<SubscriptionJobData>, done: any): Promise<void> {
  try {
    const { userId, action } = job.data;
    
    const user = await Users.findOneBy({ id: userId });
    if (!user) {
      logger.warn(`Cannot process subscription job for non-existent user: ${userId}`);
      done();
      return;
    }

    switch (action) {
      case 'check-expiring':
        await handleUserExpiration(user);
        break;
      case 'daily-check':
        await handleDailyCheck(user);
        break;
      default:
        logger.warn(`Unknown subscription action: ${action}`);
    }

    done();
  } catch (error) {
    logger.error(`Error processing subscription job: ${error}`, { error, jobData: job.data });
    done(error);
  }
}

/**
 * Handle user subscription/credit expiration
 */
async function handleUserExpiration(user: User): Promise<void> {
  try {
    logger.info(`Processing expiration check for user ${user.id}`);
    
    // Use the SubscriptionManager to handle all expiration logic
    await SubscriptionManager.handleSubscriptionExpiration(user.id);
    
    logger.info(`Completed expiration check for user ${user.id}`);
  } catch (error) {
    logger.error(`Error handling user expiration: ${error}`, { error, userId: user.id });
    throw error;
  }
}

/**
 * Handle daily subscription and credit checks
 */
async function handleDailyCheck(user: User): Promise<void> {
  try {
    logger.info(`Processing daily check for user ${user.id}`);
    
    // Refresh user data to get latest state
    const freshUser = await Users.findOneBy({ id: user.id });
    if (!freshUser) {
      logger.warn(`User ${user.id} not found during daily check`);
      return;
    }
    
    // Handle any expired credits or subscriptions
    await SubscriptionManager.handleSubscriptionExpiration(freshUser.id);
    
    // Update subscription status based on current state
    await SubscriptionManager.updateSubscriptionStatus(freshUser.id);
    
    logger.info(`Completed daily check for user ${user.id}`);
  } catch (error) {
    logger.error(`Error in daily check: ${error}`, { error, userId: user.id });
    throw error;
  }
}
