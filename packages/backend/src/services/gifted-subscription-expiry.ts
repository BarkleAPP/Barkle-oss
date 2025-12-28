import { GiftedSubscriptions } from '@/models/index.js';
import Logger from '@/services/logger.js';
import { HOUR } from '@/const.js';

const logger = new Logger('giftedSubscriptionExpiry');

export async function checkExpiredGiftedSubscriptions(): Promise<void> {
  try {
    const expiredCount = await GiftedSubscriptions.processExpiredGifts();
    
    if (expiredCount > 0) {
      logger.info(`Marked ${expiredCount} gifted subscriptions as expired.`);
    }
  } catch (error) {
    logger.error(`Error processing expired gifted subscriptions: ${error}`);
  }
}

export function startGiftedSubscriptionExpiryTask(): NodeJS.Timer {
  checkExpiredGiftedSubscriptions().catch(() => {});
  
  return setInterval(() => {
    checkExpiredGiftedSubscriptions().catch(() => {});
  }, HOUR * 12);
}
