import { Brackets } from 'typeorm';
import { fetchMeta } from '@/misc/fetch-meta.js';
import { Followings, Notes, Mutings, Blockings } from '@/models/index.js';
import { activeUsersChart } from '@/services/chart/index.js';
import define from '../../define.js';
import { ApiError } from '../../error.js';
import { makePaginationQuery } from '../../common/make-pagination-query.js';
import { generateVisibilityQuery } from '../../common/generate-visibility-query.js';
import { generateMutedNoteQuery } from '../../common/generate-muted-note-query.js';
import { generateRepliesQuery } from '../../common/generate-replies-query.js';
import { generateChannelQuery } from '../../common/generate-channel-query.js';

import { algorithmClient, type EnhancedTimelineResult } from '@/services/algorithm/algorithm-microservice-client.js';
import { timelineMixerService } from '@/services/algorithm/timeline-mixer-service.js';
import { abTestingService } from '@/services/algorithm/ab-testing-service.js';
import { Note } from '@/models/entities/note.js';

export const meta = {
  tags: ['notes'],
  requireCredential: true,
  res: {
    type: 'object',
    optional: false, nullable: false,
    oneOf: [
      {
        // Enhanced format (when using advanced algorithm)
        type: 'object',
        properties: {
          notes: {
            type: 'array',
            items: { type: 'object', ref: 'Note' },
          },
          cursor: { type: 'string', nullable: true },
          hasMore: { type: 'boolean' },
          batchSize: { type: 'integer' },
          caughtUp: {
            type: 'object',
            nullable: true,
            properties: {
              isCaughtUp: { type: 'boolean' },
              oldestContentDate: { type: 'string', format: 'date-time', nullable: true },
              daysSinceContent: { type: 'integer', nullable: true },
            },
          },
        },
      },
      {
        // Legacy format (simple array for backward compatibility)
        type: 'array',
        items: { type: 'object', ref: 'Note' },
      },
    ],
  },
  errors: {
    stlDisabled: {
      message: 'Hybrid timeline has been disabled.',
      code: 'STL_DISABLED',
      id: '620763f4-f621-4533-ab33-0577a1a3c342',
    },
  },
} as const;

export const paramDef = {
  type: 'object',
  properties: {
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
    sinceId: { type: 'string', format: 'barkle:id' },
    untilId: { type: 'string', format: 'barkle:id' },
    sinceDate: { type: 'integer' },
    untilDate: { type: 'integer' },
    includeMyRenotes: { type: 'boolean', default: true },
    includeRenotedMyNotes: { type: 'boolean', default: true },
    includeLocalRenotes: { type: 'boolean', default: true },
    withFiles: {
      type: 'boolean',
      default: false,
      description: 'Only show notes that have attached files.',
    },
    algorithmVersion: {
      type: 'string',
      enum: ['legacy', 'v1', 'v2', 'ml'],
      default: 'ml',
      description: 'Algorithm version to use for timeline generation',
    },
    useAdvancedAlgorithm: {
      type: 'boolean',
      default: true,
      description: 'Whether to use the advanced ML-based algorithm',
    },
    useMLRanking: {
      type: 'boolean',
      default: true,
      description: 'Whether to use real ML model for ranking (falls back to heuristics if unavailable)',
    },
    useMicroservice: {
      type: 'boolean',
      default: true,
      description: 'Whether to use the algorithm microservice for enhanced timeline generation',
    },
    cursor: {
      type: 'string',
      description: 'Pagination cursor for infinite scroll',
    },
    enhancedFormat: {
      type: 'boolean',
      default: false,
      description: 'Return enhanced format with metadata (cursor, hasMore, etc.)',
    },
    sessionId: {
      type: 'string',
      description: 'Session ID for tracking seen content and ensuring fresh mixes',
    },
    forceRefresh: {
      type: 'boolean',
      default: false,
      description: 'Force refresh timeline cache for fresh content',
    },
    enableMixer: {
      type: 'boolean',
      default: true,
      description: 'Enable timeline mixer for dynamic content mixing',
    },
    mixerIntensity: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      default: 0.8,
      description: 'Intensity of content mixing (0 = minimal, 1 = maximum freshness)',
    },
  },
  required: [],
} as const;

/**
 * Parse cursor for backward compatibility with sinceId/untilId
 */
function parseCursor(ps: any): { sinceId?: string; untilId?: string; sinceDate?: number; untilDate?: number } {
  // Priority: explicit sinceId/untilId > cursor > sinceDate/untilDate
  if (ps.sinceId || ps.untilId) {
    return {
      sinceId: ps.sinceId,
      untilId: ps.untilId,
    };
  }

  if (ps.cursor && ps.cursor !== 'end') {
    try {
      // Parse JSON cursor format
      const parsed = JSON.parse(ps.cursor);
      return {
        sinceId: parsed.sinceId,
        untilId: parsed.untilId,
        sinceDate: parsed.sinceDate,
        untilDate: parsed.untilDate,
      };
    } catch (error) {
      // Invalid cursor, fall back to date-based
    }
  }

  return {
    sinceDate: ps.sinceDate,
    untilDate: ps.untilDate,
  };
}



/**
 * Get timeline posts using proper ORM with complete muting/blocking support
 */
async function getTimelinePosts(user: any, ps: any, cursor: any): Promise<{ notes: Note[], followingIds: string[] }> {
  // Get all exclusion lists using ORM
  const [myFollowings, myMutings, myBlockings, blockingMe] = await Promise.all([
    Followings.find({
      where: { followerId: user.id },
      select: ['followeeId'],
    }),
    Mutings.find({
      where: { muterId: user.id },
      select: ['muteeId'],
    }),
    Blockings.find({
      where: { blockerId: user.id },
      select: ['blockeeId'],
    }),
    Blockings.find({
      where: { blockeeId: user.id },
      select: ['blockerId'],
    }),
  ]);

  const followingIds = myFollowings.map((f: any) => f.followeeId);
  const mutedIds = myMutings.map((m: any) => m.muteeId);
  const blockedIds = myBlockings.map((b: any) => b.blockeeId);
  const blockingMeIds = blockingMe.map((b: any) => b.blockerId);

  // Build query with proper pagination
  let query = makePaginationQuery(
    Notes.createQueryBuilder('note'),
    cursor.sinceId,
    cursor.untilId,
    cursor.sinceDate,
    cursor.untilDate
  );

  // Timeline content sources
  query = query
    .andWhere(new Brackets(qb => {
      // Posts from people I follow
      if (followingIds.length > 0) {
        qb.orWhere('note.userId IN (:...followingIds)', { followingIds });
      }
      // My own posts
      qb.orWhere('note.userId = :meId', { meId: user.id });
      // Public posts from local users (discovery)
      qb.orWhere('(note.visibility = :public AND note.userHost IS NULL)', { public: 'public' });
    }))
    .innerJoinAndSelect('note.user', 'user')
    .leftJoinAndSelect('user.avatar', 'avatar')
    .leftJoinAndSelect('user.banner', 'banner')
    .leftJoinAndSelect('note.reply', 'reply')
    .leftJoinAndSelect('note.renote', 'renote')
    .leftJoinAndSelect('reply.user', 'replyUser')
    .leftJoinAndSelect('replyUser.avatar', 'replyUserAvatar')
    .leftJoinAndSelect('replyUser.banner', 'replyUserBanner')
    .leftJoinAndSelect('renote.user', 'renoteUser')
    .leftJoinAndSelect('renoteUser.avatar', 'renoteUserAvatar')
    .leftJoinAndSelect('renoteUser.banner', 'renoteUserBanner');

  // Apply exclusions for muted/blocked users
  const excludeIds = [...mutedIds, ...blockedIds, ...blockingMeIds].filter(Boolean);
  if (excludeIds.length > 0) {
    query.andWhere('note.userId NOT IN (:...excludeIds)', { excludeIds });
    // Also exclude renotes and replies from blocked users
    query.andWhere(new Brackets(qb => {
      qb.where('note.renoteUserId IS NULL')
        .orWhere('note.renoteUserId NOT IN (:...excludeIds)', { excludeIds });
    }));
    query.andWhere(new Brackets(qb => {
      qb.where('note.replyUserId IS NULL')
        .orWhere('note.replyUserId NOT IN (:...excludeIds)', { excludeIds });
    }));
  }

  // Apply standard filters
  generateVisibilityQuery(query, user);
  generateMutedNoteQuery(query, user);
  generateRepliesQuery(query, user);
  generateChannelQuery(query, user);

  // Apply renote preferences
  if (!ps.includeMyRenotes) {
    query.andWhere(new Brackets(qb => {
      qb.orWhere('note.userId != :meId', { meId: user.id });
      qb.orWhere('note.renoteId IS NULL');
      qb.orWhere('note.text IS NOT NULL');
      qb.orWhere('note.fileIds != :emptyArray', { emptyArray: '{}' });
    }));
  }

  if (!ps.includeRenotedMyNotes) {
    query.andWhere(new Brackets(qb => {
      qb.orWhere('note.renoteUserId != :meId', { meId: user.id });
      qb.orWhere('note.renoteId IS NULL');
      qb.orWhere('note.text IS NOT NULL');
      qb.orWhere('note.fileIds != :emptyArray', { emptyArray: '{}' });
    }));
  }

  if (!ps.includeLocalRenotes) {
    query.andWhere(new Brackets(qb => {
      qb.orWhere('note.renoteUserHost IS NOT NULL');
      qb.orWhere('note.renoteId IS NULL');
      qb.orWhere('note.text IS NOT NULL');
      qb.orWhere('note.fileIds != :emptyArray', { emptyArray: '{}' });
    }));
  }

  if (ps.withFiles) {
    query.andWhere('note.fileIds != :emptyArray', { emptyArray: '{}' });
  }

  // Fetch MORE than requested for algorithm processing
  // Increased multiplier to ensure enough content after filtering
  const fetchMultiplier = 5; // Fetch 5x to account for algorithm filtering
  return {
    notes: await query.take(ps.limit * fetchMultiplier).getMany(),
    followingIds
  };
}

/**
 * Simple chronological ordering for fallback
 */
function createChronologicalTimeline(notes: Note[], limit: number): Note[] {
  return notes
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

export default define(meta, paramDef, async (ps, user) => {
  const m = await fetchMeta();
  if (m.disableLocalTimeline && (!user.isAdmin && !user.isModerator)) {
    throw new ApiError(meta.errors.stlDisabled);
  }

  // Parse cursor for backward compatibility
  const cursor = parseCursor(ps);

  // Force cache invalidation if requested
  if (ps.forceRefresh) {
    timelineMixerService.invalidateUserCache(user.id);
  }

  // Generate session ID for content tracking (legacy client support)
  const sessionId = ps.sessionId || `legacy_${user.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Detect client capabilities
  const isLegacyClient = !ps.sessionId && !ps.hasOwnProperty('enableMixer');
  const enableMixer = isLegacyClient ? true : (ps.enableMixer !== false); // Default enabled for legacy clients

  // Try Algorithm Microservice first (most advanced)
  if (ps.useMicroservice && ps.useAdvancedAlgorithm) {
    try {
      // Get timeline posts for microservice processing
      const timelineResult = await getTimelinePosts(user, ps, cursor);
      const timelinePosts = timelineResult.notes;
      const followingIds = timelineResult.followingIds;

      // CRITICAL FIX: Handle empty timeline (end of scroll)
      if (timelinePosts.length === 0) {
        if (typeof process !== 'undefined' && process.nextTick) {
          process.nextTick(() => activeUsersChart.read(user));
        }

        // Return empty result in appropriate format
        if (isLegacyClient && !ps.enhancedFormat) {
          return []; // Legacy clients expect simple array
        }

        return {
          notes: [],
          cursor: null,
          hasMore: false,
          batchSize: 0,
          sessionId: isLegacyClient ? undefined : sessionId,
        };
      }

      // Continue with normal processing for non-empty timeline
      if (timelinePosts.length > 0) {
        // Get user's A/B test configuration
        const abConfig = await abTestingService.getUserTimelineConfig(user.id);

        // Use algorithm microservice for enhanced timeline generation
        // The microservice handles ALL diversity controls internally from AB config
        const result: EnhancedTimelineResult = await algorithmClient.generateEnhancedTimeline(
          timelinePosts,
          user,
          {
            limit: ps.limit,
            cursor: ps.cursor,
            sinceId: cursor.sinceId,
            untilId: cursor.untilId,
            enhancedFormat: ps.enhancedFormat,
            sessionId,
            forceRefresh: ps.forceRefresh,
            legacyMode: isLegacyClient
          }
        );

        // Pack notes with enhanced metadata
        const packedNotes = await Notes.packMany(
          result.rankedNotes.map(item => item.note),
          user
        );

        // Add algorithm metadata to notes
        const notesWithAlgorithm = packedNotes.map((note, index) => ({
          ...note,
          _algorithmRanking: {
            score: Math.round(result.rankedNotes[index].score * 100) / 100,
            reasons: result.rankedNotes[index].reasons,
            qualityAssessment: result.rankedNotes[index].qualityAssessment,
            injectionSignal: result.rankedNotes[index].injectionSignal
          }
        }));

        // Track user activity and timeline view
        if (typeof process !== 'undefined' && process.nextTick) {
          process.nextTick(() => {
            activeUsersChart.read(user);

            // Track timeline view for algorithm learning
            algorithmClient.recordEngagement(user.id, 'timeline_view', 'view', {
              algorithmVersion: result.metadata.algorithmVersion,
              diversityScore: result.metadata.diversityScore,
              itemCount: result.rankedNotes.length,
              processingTime: result.metadata.processingTimeMs,
              timestamp: new Date()
            }).catch(error => {
              console.error('Failed to track timeline view:', error);
            });
          });
        }

        // Generate cursor for pagination with algorithm-aware deduplication
        const nextCursor = notesWithAlgorithm.length > 0 ? JSON.stringify({
          untilId: notesWithAlgorithm[notesWithAlgorithm.length - 1].id,
          untilDate: notesWithAlgorithm[notesWithAlgorithm.length - 1].createdAt,
          algorithmVersion: result.metadata.algorithmVersion,
          seenCount: result.rankedNotes.length
        }) : null;

        // Return format based on client capabilities
        if (isLegacyClient && !ps.enhancedFormat) {
          // CRITICAL FIX: Legacy clients using sinceId/untilId for infinite scroll
          // The database already filtered correctly, mixing is fine,
          // just return the mixed results as-is for legacy compatibility
          return notesWithAlgorithm;
        }

        // Enhanced format with microservice metadata for new clients
        return {
          notes: notesWithAlgorithm,
          cursor: nextCursor,
          hasMore: timelinePosts.length > ps.limit,
          batchSize: notesWithAlgorithm.length,
          sessionId: isLegacyClient ? undefined : sessionId, // Don't expose session ID to legacy clients
          _algorithmMetadata: {
            totalProcessed: result.metadata.totalProcessed,
            diversityScore: result.metadata.diversityScore,
            personalizedCount: result.metadata.personalizedCount,
            freshCount: result.metadata.freshCount,
            processingTimeMs: result.metadata.processingTimeMs,
            algorithmVersion: result.metadata.algorithmVersion,
            cacheHitRate: result.metadata.cacheHitRate,
            qualityFilteredCount: result.metadata.qualityFilteredCount,
            mmrStats: result.metadata.mmrStats,
            legacyMode: isLegacyClient,
            abTestVariant: (await abTestingService.getUserAssignment(user.id)).experiments
          }
        };
      }
    } catch (error) {
      console.error('Algorithm microservice failed, falling back to ML algorithm:', error);
      // Fall through to ML algorithm
    }
  }

  // Try ML-powered algorithm as fallback
  if (ps.useAdvancedAlgorithm && (ps.algorithmVersion === 'ml' || ps.useMLRanking)) {
    try {
      // Get timeline posts for ML ranking
      const timelineResult = await getTimelinePosts(user, ps, cursor);
      const timelinePosts = timelineResult.notes;
      const followingIds = timelineResult.followingIds;

      // CRITICAL FIX: Handle empty timeline (end of scroll)
      if (timelinePosts.length === 0) {
        if (typeof process !== 'undefined' && process.nextTick) {
          process.nextTick(() => activeUsersChart.read(user));
        }

        // Return empty result in appropriate format
        if (isLegacyClient && !ps.enhancedFormat) {
          return []; // Legacy clients expect simple array
        }

        return {
          notes: [],
          cursor: null,
          hasMore: false,
          batchSize: 0,
        };
      }

      // Continue with normal processing for non-empty timeline
      if (timelinePosts.length > 0) {
        // Get user's A/B test configuration
        const abConfig = await abTestingService.getUserTimelineConfig(user.id);

        // Apply timeline mixer for fresh content
        // TODO: This should also be moved into ScalableTimelineService
        const mixerResult = await timelineMixerService.generateMixedTimeline(timelinePosts, {
          userId: user.id,
          limit: ps.limit * 3,
          diversityLevel: abConfig.weights.diversity,
          enableFreshness: true,
          enableSerendipity: abConfig.weights.serendipity > 0.1,
          cacheBypass: ps.forceRefresh,
          sessionId,
          // Diversity controls from AB config
          showTimelineReplies: user.showTimelineReplies ?? abConfig.diversityControls.showTimelineReplies,
          maxPostsPerUser: abConfig.diversityControls.maxPostsPerUser,
          maxSelfPosts: abConfig.diversityControls.maxSelfPosts,
          minimumRetention: abConfig.diversityControls.minimumRetention,
          followingIds
        });
        const processedNotes = mixerResult.notes;

        // Use algorithm client for enhanced timeline generation
        const result = await algorithmClient.generateEnhancedTimeline(
          processedNotes,
          user,
          {
            limit: ps.limit,
            cursor: cursor ? JSON.stringify(cursor) : undefined,
            sinceId: ps.sinceId,
            untilId: ps.untilId,
            enhancedFormat: true,
            sessionId,
            forceRefresh: ps.forceRefresh,
            legacyMode: false
          }
        );

        // Pack notes with ML metadata
        const packedNotes = await Notes.packMany(
          result.rankedNotes.map((item: any) => item.note),
          user
        );

        // Add ML ranking metadata to notes
        const notesWithML = packedNotes.map((note, index) => ({
          ...note,
          _mlRanking: {
            score: Math.round(result.rankedNotes[index].score * 100) / 100,
            reasons: result.rankedNotes[index].reasons
          }
        }));

        // Track user activity
        if (typeof process !== 'undefined' && process.nextTick) {
          process.nextTick(() => {
            activeUsersChart.read(user);
          });
        }

        // Generate cursor for pagination
        const nextCursor = notesWithML.length > 0 ? JSON.stringify({
          untilId: notesWithML[notesWithML.length - 1].id,
          untilDate: notesWithML[notesWithML.length - 1].createdAt,
        }) : null;

        // Return enhanced format with ML metadata
        return {
          notes: notesWithML,
          cursor: nextCursor,
          hasMore: timelinePosts.length > ps.limit,
          batchSize: notesWithML.length,
          _mlMetadata: {
            communitySize: 0, // Not available in simplified client
            mlModelUsed: result.metadata.algorithmVersion,
            processingTimeMs: result.metadata.processingTimeMs,
            diversityIndex: result.metadata.diversityScore,
            personalizationStrength: result.metadata.personalizedCount / Math.max(result.metadata.totalProcessed, 1),
            algorithmVersion: result.metadata.algorithmVersion
          }
        };
      }
    } catch (error) {
      console.error('ML algorithm failed, falling back to simple timeline:', error);
      // Fall through to simple timeline
    }
  }

  // Legacy algorithms removed - only ML and simple timeline remain

  // Simple timeline algorithm fallback with mixer
  try {
    const timelineResult = await getTimelinePosts(user, ps, cursor);
    const timeline = timelineResult.notes;
    const followingIds = timelineResult.followingIds;

    // Handle empty timeline case
    if (timeline.length === 0) {
      if (typeof process !== 'undefined' && process.nextTick) {
        process.nextTick(() => {
          activeUsersChart.read(user);
        });
      }

      // Return format based on client preference
      if (ps.enhancedFormat || ps.cursor) {
        return {
          notes: [],
          cursor: null,
          hasMore: false,
          batchSize: 0,
          sessionId,
        };
      }
      return [];
    }

    // Apply timeline mixer even for simple timeline to ensure freshness
    // TODO: This should also be moved into a service
    const mixerResult = await timelineMixerService.generateMixedTimeline(timeline, {
      userId: user.id,
      limit: ps.limit,
      diversityLevel: 0.2,
      enableFreshness: true,
      enableSerendipity: false,
      cacheBypass: ps.forceRefresh, // CRITICAL: Pass forceRefresh to enable proper mixing on refresh
      sessionId,
      // Use defaults for fallback (no AB config available)
      showTimelineReplies: user.showTimelineReplies ?? true,
      maxPostsPerUser: 5,
      maxSelfPosts: 3,
      minimumRetention: 0.4,
      followingIds
    });

    const orderedPosts = mixerResult.notes;
    const hasMore = timeline.length > ps.limit;

    if (typeof process !== 'undefined' && process.nextTick) {
      process.nextTick(() => {
        activeUsersChart.read(user);
      });
    }

    const packedNotes = await Notes.packMany(orderedPosts, user);

    // Return format based on client preference
    if (ps.enhancedFormat || ps.cursor) {
      // Enhanced format with metadata
      const nextCursor = orderedPosts.length > 0 ? JSON.stringify({
        untilId: orderedPosts[orderedPosts.length - 1].id,
        untilDate: orderedPosts[orderedPosts.length - 1].createdAt.getTime(),
      }) : null;

      return {
        notes: packedNotes,
        cursor: hasMore ? nextCursor : null,
        hasMore,
        batchSize: packedNotes.length,
      };
    }

    // Legacy format (simple array)
    return packedNotes;
  } catch (error) {
    console.error('Timeline generation failed:', error);

    // Return empty timeline on error to prevent crashes
    if (ps.enhancedFormat || ps.cursor) {
      return {
        notes: [],
        cursor: null,
        hasMore: false,
        batchSize: 0,
      };
    }
    return [];
  }
});