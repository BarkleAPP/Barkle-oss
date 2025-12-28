import define from '../../define.js';
import { signalCollectionService } from '@/services/algorithm/signal-collection-service.js';
import Logger from '@/services/logger.js';

const logger = new Logger('algorithm-collect-signals');

export const meta = {
    tags: ['algorithm'],
    requireCredential: true,
    res: {
        type: 'object',
        optional: false, nullable: false,
        properties: {
            success: {
                type: 'boolean',
                optional: false, nullable: false,
            },
            processed: {
                type: 'number',
                optional: false, nullable: false,
            },
        },
    },
} as const;

export const paramDef = {
    type: 'object',
    properties: {
        signals: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    type: {
                        type: 'string',
                        enum: ['note_view', 'note_reaction', 'note_reply', 'note_renote', 'note_share', 'note_bookmark', 'profile_view', 'timeline_view', 'search_query', 'follow_action', 'dwell_time', 'scroll_depth']
                    },
                    contentId: { type: 'string' },
                    context: {
                        type: 'object',
                        properties: {
                            source: {
                                type: 'string',
                                enum: ['timeline', 'search', 'notification', 'profile', 'direct']
                            },
                            deviceType: {
                                type: 'string',
                                enum: ['mobile', 'desktop', 'tablet']
                            },
                            timelinePosition: { type: 'number' },
                            dwellTimeMs: { type: 'number' },
                            scrollDepth: { type: 'number' },
                            sessionId: { type: 'string' },
                            referrer: { type: 'string' },
                            reactionType: { type: 'string' },
                            searchQuery: { type: 'string' },
                            action: { type: 'string' }
                        }
                    }
                },
                required: ['type', 'contentId']
            }
        }
    },
    required: ['signals']
} as const;

export default define(meta, paramDef, async (ps, user) => {
    try {
        let processedCount = 0;

        // Process each signal
        for (const signal of ps.signals) {
            await signalCollectionService.collectSignal(
                user.id,
                signal.type as any,
                signal.contentId,
                signal.context || {}
            );
            processedCount++;
        }

        logger.info(`Processed ${processedCount} signals for user ${user.id}`);

        return {
            success: true,
            processed: processedCount
        };
    } catch (error) {
        logger.error('Error collecting signals:', error as Error);
        return {
            success: false,
            processed: 0
        };
    }
});