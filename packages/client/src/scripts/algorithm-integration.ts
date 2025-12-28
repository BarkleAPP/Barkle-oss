/**
 * Algorithm Integration for Barkle Client
 * 
 * This module provides automatic integration of algorithm tracking
 * throughout the client application.
 */

import { algorithmTracker } from '@/services/algorithm-tracker';
import { defaultStore } from '@/store';

// Global flag to enable/disable algorithm tracking
let isAlgorithmTrackingEnabled = true;

/**
 * Initialize algorithm tracking based on user preferences
 */
export function initializeAlgorithmTracking(): void {
	// Check if user has opted out of algorithm tracking
	const userPreference = defaultStore.state.algorithmTrackingEnabled;
	if (userPreference !== undefined) {
		isAlgorithmTrackingEnabled = userPreference;
		algorithmTracker.setEnabled(isAlgorithmTrackingEnabled);
	}

	// Listen for preference changes
	defaultStore.watch((state) => state.algorithmTrackingEnabled, (enabled) => {
		if (enabled !== undefined) {
			isAlgorithmTrackingEnabled = enabled;
			algorithmTracker.setEnabled(enabled);
		}
	});
}

/**
 * Check if algorithm tracking is currently enabled
 */
export function isTrackingEnabled(): boolean {
	return isAlgorithmTrackingEnabled && algorithmTracker.isTrackingEnabled();
}

/**
 * Wrapper functions for common tracking actions
 */
export const trackingActions = {
	/**
	 * Track when user reacts to a note
	 */
	async trackReaction(noteId: string, reactionType: string): Promise<void> {
		if (!isTrackingEnabled()) return;
		await algorithmTracker.trackReaction(noteId, reactionType);
	},

	/**
	 * Track when user shares/renotes a note
	 */
	async trackShare(noteId: string): Promise<void> {
		if (!isTrackingEnabled()) return;
		await algorithmTracker.trackShare(noteId);
	},

	/**
	 * Track when user replies to a note
	 */
	async trackReply(noteId: string): Promise<void> {
		if (!isTrackingEnabled()) return;
		await algorithmTracker.trackComment(noteId);
	},

	/**
	 * Track when user views a note
	 */
	async trackView(noteId: string): Promise<void> {
		if (!isTrackingEnabled()) return;
		await algorithmTracker.trackView(noteId);
	},

	/**
	 * Track dwell time on a note
	 */
	async trackDwell(noteId: string): Promise<void> {
		if (!isTrackingEnabled()) return;
		await algorithmTracker.trackDwell(noteId);
	},

	/**
	 * Track when user skips a note
	 */
	async trackSkip(noteId: string): Promise<void> {
		if (!isTrackingEnabled()) return;
		await algorithmTracker.trackSkip(noteId);
	},

	/**
	 * Track when user blocks content
	 */
	async trackBlock(noteId: string): Promise<void> {
		if (!isTrackingEnabled()) return;
		await algorithmTracker.trackBlock(noteId);
	},
};

/**
 * Auto-track common user interactions
 */
export function setupAutoTracking(): void {
	// This could be expanded to automatically track certain DOM events
	// For now, we rely on explicit tracking in components
}

// Initialize tracking when module is imported
initializeAlgorithmTracking();