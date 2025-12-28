/**
 * Subscription Status Enum
 * Defines all possible subscription states for a user
 */
export enum SubscriptionStatus {
  // Free tier - no active subscription
  FREE = 'FREE',
  
  // Active paid subscriptions
  BARKLE_PLUS = 'BARKLE_PLUS',
  MINI_PLUS = 'MINI_PLUS',
  
  // Credit-based states
  BARKLE_PLUS_CREDIT = 'BARKLE_PLUS_CREDIT',
  MINI_PLUS_CREDIT = 'MINI_PLUS_CREDIT',
  
  // Paused states (when credits are being used)
  BARKLE_PLUS_PAUSED = 'BARKLE_PLUS_PAUSED',
  MINI_PLUS_PAUSED = 'MINI_PLUS_PAUSED',
  
  // Expired/cancelled states (not in DB enum - handled in application logic)
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED'
}

/**
 * Helper functions for subscription status management
 */
export class SubscriptionStatusHelper {
  static isPaidSubscription(status: SubscriptionStatus): boolean {
    return [
      SubscriptionStatus.BARKLE_PLUS,
      SubscriptionStatus.MINI_PLUS
    ].includes(status);
  }

  static isCreditSubscription(status: SubscriptionStatus): boolean {
    return [
      SubscriptionStatus.BARKLE_PLUS_CREDIT,
      SubscriptionStatus.MINI_PLUS_CREDIT
    ].includes(status);
  }

  static isPausedSubscription(status: SubscriptionStatus): boolean {
    return [
      SubscriptionStatus.BARKLE_PLUS_PAUSED,
      SubscriptionStatus.MINI_PLUS_PAUSED
    ].includes(status);
  }

  static hasBarklePlusAccess(status: SubscriptionStatus): boolean {
    return [
      SubscriptionStatus.BARKLE_PLUS,
      SubscriptionStatus.BARKLE_PLUS_CREDIT,
      SubscriptionStatus.BARKLE_PLUS_PAUSED
    ].includes(status);
  }

  static hasMiniPlusAccess(status: SubscriptionStatus): boolean {
    return [
      SubscriptionStatus.MINI_PLUS,
      SubscriptionStatus.MINI_PLUS_CREDIT,
      SubscriptionStatus.MINI_PLUS_PAUSED,
      // Barkle+ includes Mini+ features
      SubscriptionStatus.BARKLE_PLUS,
      SubscriptionStatus.BARKLE_PLUS_CREDIT,
      SubscriptionStatus.BARKLE_PLUS_PAUSED
    ].includes(status);
  }

  static isActive(status: SubscriptionStatus): boolean {
    return status !== SubscriptionStatus.FREE && 
           status !== SubscriptionStatus.EXPIRED && 
           status !== SubscriptionStatus.CANCELLED;
  }

  /**
   * Determines the subscription status based on current user state
   */
  static determineStatus(
    isPlus: boolean,
    isMPlus: boolean,
    subscriptionEndDate: Date | null,
    barklePlusCreditEndDate: Date | null,
    miniPlusCreditEndDate: Date | null,
    pausedSubscriptionId: string | null
  ): SubscriptionStatus {
    const now = new Date();

    // Check for active credits first
    if (barklePlusCreditEndDate && barklePlusCreditEndDate > now) {
      return pausedSubscriptionId ? 
        SubscriptionStatus.BARKLE_PLUS_PAUSED : 
        SubscriptionStatus.BARKLE_PLUS_CREDIT;
    }

    if (miniPlusCreditEndDate && miniPlusCreditEndDate > now) {
      return pausedSubscriptionId ? 
        SubscriptionStatus.MINI_PLUS_PAUSED : 
        SubscriptionStatus.MINI_PLUS_CREDIT;
    }

    // Check for active paid subscriptions
    if (subscriptionEndDate && subscriptionEndDate > now) {
      if (isPlus) return SubscriptionStatus.BARKLE_PLUS;
      if (isMPlus) return SubscriptionStatus.MINI_PLUS;
    }

    // Default to free if no active subscription or credits
    return SubscriptionStatus.FREE;
  }
}
