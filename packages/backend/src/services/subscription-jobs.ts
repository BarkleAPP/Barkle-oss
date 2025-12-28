import { User } from '@/models/entities/user.js';
import { subscriptionQueue } from '@/queue/queues.js';
import { SubscriptionJobData } from '@/queue/types.js';

/**
 * Create a job to check if a user's subscription is expiring
 */
export function createCheckExpiringSubscriptionJob(userId: User['id']) {
  return subscriptionQueue.add({
    userId,
    action: 'check-expiring',
  } as SubscriptionJobData, {
    removeOnComplete: true,
    removeOnFail: true,
  });
}

/**
 * Create a job for daily subscription/credit checks
 */
export function createDailyCheckJob(userId: User['id']) {
  return subscriptionQueue.add({
    userId,
    action: 'daily-check',
  } as SubscriptionJobData, {
    removeOnComplete: true,
    removeOnFail: true,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  });
}

/**
 * Schedule daily check jobs for all active users with subscriptions or credits
 */
export async function scheduleDailyChecks() {
  const { Users } = await import('@/models/index.js');
  
  // Find users who have any subscription or credit data
  const usersToCheck = await Users.find({
    where: [
      { subscriptionEndDate: new Date() }, // Any subscription end date
      { barklePlusCredits: 1 }, // Any Barkle+ credits > 0  
      { miniPlusCredits: 1 }, // Any Mini+ credits > 0
      { pausedSubscriptionId: '1' }, // Any paused subscription
    ],
    select: ['id']
  });
  
  for (const user of usersToCheck) {
    await createDailyCheckJob(user.id);
  }
  
  return usersToCheck.length;
}
