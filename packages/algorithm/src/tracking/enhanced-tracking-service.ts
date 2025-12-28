/**
 * Enhanced Tracking Service with Rich Categorization
 * Part of @barkle/algorithm microservice
 * 
 * Tracks comprehensive user behavior across multiple dimensions
 */

// ========== TRACKING CATEGORIES ==========

export enum InteractionCategory {
	// Content Engagement
	CONTENT_VIEW = 'content_view',
	CONTENT_ENGAGEMENT = 'content_engagement',
	CONTENT_CREATION = 'content_creation',
	
	// Social Actions
	SOCIAL_FOLLOW = 'social_follow',
	SOCIAL_MENTION = 'social_mention',
	SOCIAL_SHARE = 'social_share',
	
	// Navigation
	NAVIGATION_TIMELINE = 'navigation_timeline',
	NAVIGATION_SEARCH = 'navigation_search',
	NAVIGATION_PROFILE = 'navigation_profile',
	
	// Preferences
	PREFERENCE_EXPLICIT = 'preference_explicit',
	PREFERENCE_IMPLICIT = 'preference_implicit',
	
	// Quality Signals
	QUALITY_POSITIVE = 'quality_positive',
	QUALITY_NEGATIVE = 'quality_negative',
	
	// System
	SYSTEM_ERROR = 'system_error',
	SYSTEM_PERFORMANCE = 'system_performance',
}

export enum ContentType {
	TEXT_POST = 'text_post',
	IMAGE_POST = 'image_post',
	VIDEO_POST = 'video_post',
	POLL = 'poll',
	QUOTE = 'quote',
	REPLY = 'reply',
	RENOTE = 'renote',
	ANNOUNCEMENT = 'announcement',
}

export enum EngagementDepth {
	PASSIVE = 'passive',       // Scroll past, brief view
	LIGHT = 'light',          // Quick reaction, short dwell
	MEDIUM = 'medium',        // Read, longer dwell, reaction
	DEEP = 'deep',            // Reply, quote, bookmark
	COMMITTED = 'committed',   // Share, follow from post
}

export enum UserIntent {
	DISCOVER = 'discover',     // Exploring new content
	CONSUME = 'consume',       // Reading/watching content
	ENGAGE = 'engage',         // Interacting with content
	CREATE = 'create',         // Posting new content
	CONNECT = 'connect',       // Social networking
	SEARCH = 'search',         // Finding specific content
}

export enum ContextSource {
	HOME_TIMELINE = 'home_timeline',
	GLOBAL_TIMELINE = 'global_timeline',
	LOCAL_TIMELINE = 'local_timeline',
	HASHTAG_TIMELINE = 'hashtag_timeline',
	PROFILE_PAGE = 'profile_page',
	NOTIFICATION_PAGE = 'notification_page',
	SEARCH_RESULTS = 'search_results',
	DIRECT_LINK = 'direct_link',
	TRENDING_PAGE = 'trending_page',
	RECOMMENDED_FEED = 'recommended_feed',
}

// ========== TRACKING DATA STRUCTURES ==========

export interface EnhancedTrackingEvent {
	// Core Identification
	userId: string;
	contentId?: string;
	timestamp: Date;
	sessionId: string;
	
	// Categorization
	category: InteractionCategory;
	contentType?: ContentType;
	engagementDepth: EngagementDepth;
	userIntent: UserIntent;
	contextSource: ContextSource;
	
	// Behavioral Data
	dwellTimeMs?: number;
	scrollDepth?: number;
	viewportPercentage?: number;
	clickPosition?: { x: number; y: number };
	
	// Content Features
	contentFeatures?: {
		hasMedia: boolean;
		hasHashtags: boolean;
		hasMentions: boolean;
		hasLinks: boolean;
		textLength: number;
		sentiment?: 'positive' | 'neutral' | 'negative';
	};
	
	// User Context
	userContext?: {
		deviceType: 'mobile' | 'desktop' | 'tablet';
		timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
		dayOfWeek: number;
		isFirstVisit: boolean;
		sessionLength: number;
		previousActions: number;
	};
	
	// Engagement Metrics
	metrics?: {
		loadTime: number;
		interactionDelay: number;
		completionRate?: number;
	};
	
	// Additional Metadata
	metadata?: Record<string, any>;
}

export interface SimpleNote {
	id: string;
	text?: string | null;
	fileIds?: string[] | null;
	tags?: string[] | null;
	mentions?: string[] | null;
	renoteId?: string | null;
	replyId?: string | null;
}

// ========== ENHANCED TRACKING SERVICE ==========

export class EnhancedTrackingService {
	private eventHandlers: ((event: EnhancedTrackingEvent) => Promise<void>)[] = [];

	/**
	 * Register a handler for tracking events
	 * This allows the backend to inject its own storage logic
	 */
	registerEventHandler(handler: (event: EnhancedTrackingEvent) => Promise<void>): void {
		this.eventHandlers.push(handler);
	}

	/**
	 * Track a comprehensive user interaction
	 */
	async trackEvent(event: EnhancedTrackingEvent): Promise<void> {
		// Enrich event with computed fields
		const enrichedEvent = this.enrichEvent(event);
		
		// Call all registered handlers
		await Promise.all(
			this.eventHandlers.map(handler => 
				handler(enrichedEvent).catch(err => 
					console.error('Event handler failed:', err)
				)
			)
		);
	}
	
	/**
	 * Track content view with automatic categorization
	 */
	async trackContentView(
		userId: string,
		note: SimpleNote,
		context: {
			source: ContextSource;
			sessionId: string;
			dwellTimeMs?: number;
			scrollDepth?: number;
		}
	): Promise<void> {
		const event: EnhancedTrackingEvent = {
			userId,
			contentId: note.id,
			timestamp: new Date(),
			sessionId: context.sessionId,
			category: InteractionCategory.CONTENT_VIEW,
			contentType: this.detectContentType(note),
			engagementDepth: this.calculateEngagementDepth({
				dwellTimeMs: context.dwellTimeMs,
				scrollDepth: context.scrollDepth,
			}),
			userIntent: this.inferIntent(context.source),
			contextSource: context.source,
			dwellTimeMs: context.dwellTimeMs,
			scrollDepth: context.scrollDepth,
			contentFeatures: this.extractContentFeatures(note),
		};
		
		await this.trackEvent(event);
	}
	
	/**
	 * Track engagement action (like, share, reply, etc.)
	 */
	async trackEngagement(
		userId: string,
		note: SimpleNote,
		action: 'like' | 'renote' | 'reply' | 'bookmark' | 'quote',
		context: {
			source: ContextSource;
			sessionId: string;
		}
	): Promise<void> {
		const depthMap = {
			like: EngagementDepth.LIGHT,
			renote: EngagementDepth.MEDIUM,
			bookmark: EngagementDepth.MEDIUM,
			reply: EngagementDepth.DEEP,
			quote: EngagementDepth.DEEP,
		};
		
		const event: EnhancedTrackingEvent = {
			userId,
			contentId: note.id,
			timestamp: new Date(),
			sessionId: context.sessionId,
			category: InteractionCategory.CONTENT_ENGAGEMENT,
			contentType: this.detectContentType(note),
			engagementDepth: depthMap[action],
			userIntent: UserIntent.ENGAGE,
			contextSource: context.source,
			contentFeatures: this.extractContentFeatures(note),
			metadata: { action },
		};
		
		await this.trackEvent(event);
	}
	
	/**
	 * Track navigation behavior
	 */
	async trackNavigation(
		userId: string,
		from: ContextSource,
		to: ContextSource,
		sessionId: string
	): Promise<void> {
		const event: EnhancedTrackingEvent = {
			userId,
			timestamp: new Date(),
			sessionId,
			category: InteractionCategory.NAVIGATION_TIMELINE,
			engagementDepth: EngagementDepth.PASSIVE,
			userIntent: this.inferIntent(to),
			contextSource: to,
			metadata: { from, to },
		};
		
		await this.trackEvent(event);
	}
	
	// ========== PRIVATE HELPER METHODS ==========
	
	private enrichEvent(event: EnhancedTrackingEvent): EnhancedTrackingEvent {
		return {
			...event,
			userContext: event.userContext || {
				deviceType: 'desktop',
				timeOfDay: this.getTimeOfDay(),
				dayOfWeek: new Date().getDay(),
				isFirstVisit: false,
				sessionLength: 0,
				previousActions: 0,
			},
		};
	}
	
	private detectContentType(note: SimpleNote): ContentType {
		if (note.renoteId && !note.text) return ContentType.RENOTE;
		if (note.replyId) return ContentType.REPLY;
		if (note.fileIds && note.fileIds.length > 0) {
			return ContentType.IMAGE_POST;
		}
		return ContentType.TEXT_POST;
	}
	
	private calculateEngagementDepth(data: {
		dwellTimeMs?: number;
		scrollDepth?: number;
		hasInteraction?: boolean;
	}): EngagementDepth {
		const { dwellTimeMs = 0, scrollDepth = 0, hasInteraction = false } = data;
		
		if (hasInteraction) return EngagementDepth.DEEP;
		if (dwellTimeMs > 10000 && scrollDepth > 75) return EngagementDepth.MEDIUM;
		if (dwellTimeMs > 3000) return EngagementDepth.LIGHT;
		return EngagementDepth.PASSIVE;
	}
	
	private inferIntent(source: ContextSource): UserIntent {
		const intentMap: Record<ContextSource, UserIntent> = {
			[ContextSource.HOME_TIMELINE]: UserIntent.CONSUME,
			[ContextSource.GLOBAL_TIMELINE]: UserIntent.DISCOVER,
			[ContextSource.LOCAL_TIMELINE]: UserIntent.DISCOVER,
			[ContextSource.HASHTAG_TIMELINE]: UserIntent.DISCOVER,
			[ContextSource.PROFILE_PAGE]: UserIntent.CONNECT,
			[ContextSource.NOTIFICATION_PAGE]: UserIntent.ENGAGE,
			[ContextSource.SEARCH_RESULTS]: UserIntent.SEARCH,
			[ContextSource.DIRECT_LINK]: UserIntent.CONSUME,
			[ContextSource.TRENDING_PAGE]: UserIntent.DISCOVER,
			[ContextSource.RECOMMENDED_FEED]: UserIntent.DISCOVER,
		};
		
		return intentMap[source] || UserIntent.CONSUME;
	}
	
	private extractContentFeatures(note: SimpleNote) {
		return {
			hasMedia: (note.fileIds?.length || 0) > 0,
			hasHashtags: (note.tags?.length || 0) > 0,
			hasMentions: (note.mentions?.length || 0) > 0,
			hasLinks: (note.text?.includes('http') || false),
			textLength: note.text?.length || 0,
		};
	}
	
	private getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
		const hour = new Date().getHours();
		if (hour < 6) return 'night';
		if (hour < 12) return 'morning';
		if (hour < 18) return 'afternoon';
		if (hour < 22) return 'evening';
		return 'night';
	}
}

// Singleton export
export const enhancedTrackingService = new EnhancedTrackingService();
