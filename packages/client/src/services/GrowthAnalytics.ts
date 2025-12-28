/**
 * Growth Analytics Service
 * Tracks onboarding and engagement metrics for growth optimization
 */

export class GrowthAnalytics {
    private static isEnabled(): boolean {
        // Check if analytics is available and user has consented
        return typeof gtag !== 'undefined' && localStorage.getItem('analytics-consent') === 'true';
    }

    static trackOnboardingStart(): void {
        if (!this.isEnabled()) return;

        gtag('event', 'onboarding_start', {
            event_category: 'growth',
            event_label: 'user_onboarding',
        });
    }

    static trackOnboardingStep(step: string, data?: Record<string, any>): void {
        if (!this.isEnabled()) return;

        gtag('event', 'onboarding_step', {
            event_category: 'growth',
            event_label: step,
            ...data,
        });
    }

    static trackOnboardingComplete(data: {
        followedCount: number;
        timeSpent: number;
        completionRate: number;
    }): void {
        if (!this.isEnabled()) return;

        gtag('event', 'onboarding_complete', {
            event_category: 'growth',
            event_label: 'completion',
            followed_count: data.followedCount,
            time_spent: data.timeSpent,
            completion_rate: data.completionRate,
        });
    }

    static trackFollowSuggestionInteraction(action: 'view' | 'follow' | 'skip', userId?: string): void {
        if (!this.isEnabled()) return;

        gtag('event', 'follow_suggestion_interaction', {
            event_category: 'growth',
            event_label: action,
            user_id: userId,
        });
    }

    static trackSocialProofView(type: 'mutual_connections' | 'contact_match', count?: number): void {
        if (!this.isEnabled()) return;

        gtag('event', 'social_proof_view', {
            event_category: 'growth',
            event_label: type,
            count: count,
        });
    }

    static trackRecommendationEngagement(source: 'explore' | 'onboarding' | 'timeline', action: 'view' | 'follow'): void {
        if (!this.isEnabled()) return;

        gtag('event', 'recommendation_engagement', {
            event_category: 'growth',
            event_label: `${source}_${action}`,
            source: source,
            action: action,
        });
    }
}

// Export for global use
declare global {
    interface Window {
        GrowthAnalytics: typeof GrowthAnalytics;
    }
}

if (typeof window !== 'undefined') {
    window.GrowthAnalytics = GrowthAnalytics;
}