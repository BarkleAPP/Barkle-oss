import { Brackets } from 'typeorm';
import { fetchMeta } from '@/misc/fetch-meta.js';
import { Notes, Users } from '@/models/index.js';
import { activeUsersChart } from '@/services/chart/index.js';
import define from '../../define.js';
import { ApiError } from '../../error.js';
import { generateMutedUserQuery } from '../../common/generate-muted-user-query.js';
import { makePaginationQuery } from '../../common/make-pagination-query.js';
import { generateVisibilityQuery } from '../../common/generate-visibility-query.js';
import { generateRepliesQuery } from '../../common/generate-replies-query.js';
import { generateMutedNoteQuery } from '../../common/generate-muted-note-query.js';
import { generateChannelQuery } from '../../common/generate-channel-query.js';
import { generateBlockedUserQuery } from '../../common/generate-block-query.js';

export const meta = {
	tags: ['notes'],
	requireCredentialPrivateMode: true,

	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			optional: false, nullable: false,
			ref: 'Note',
		},
	},

	errors: {
		ltlDisabled: {
			message: 'Local timeline has been disabled.',
			code: 'LTL_DISABLED',
			id: '45a6eb02-7695-4393-b023-dd3be9aaaefd',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		withFiles: {
			type: 'boolean',
			default: false,
			description: 'Only show notes that have attached files.',
		},
		fileType: { type: 'array', items: {
			type: 'string',
		} },
		excludeNsfw: { type: 'boolean', default: false },
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
		sinceId: { type: 'string', format: 'barkle:id' },
		untilId: { type: 'string', format: 'barkle:id' },
		sinceDate: { type: 'integer' },
		untilDate: { type: 'integer' },
		withReplies: { type: 'boolean', default: false },
		withRenotes: { type: 'boolean', default: true },
		onlyMedia: { type: 'boolean', default: false },
		excludeBots: { type: 'boolean', default: false },
		sort: {
			type: 'string',
			enum: ['chronological', 'trending', 'hot'],
			default: 'chronological',
			description: 'Sort order for the timeline',
		},
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const m = await fetchMeta();
	if (m.disableLocalTimeline) {
		if (user == null || (!user.isAdmin && !user.isModerator)) {
			throw new ApiError(meta.errors.ltlDisabled);
		}
	}

	//#region Construct query
	const query = makePaginationQuery(Notes.createQueryBuilder('note'),
		ps.sinceId, ps.untilId, ps.sinceDate, ps.untilDate)
		.andWhere('(note.visibility = \'public\') AND (note.userHost IS NULL)')
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

	generateChannelQuery(query, user);
	
	// Handle replies based on parameter
	if (!ps.withReplies) {
		// Default behavior - exclude pure replies
		generateRepliesQuery(query, user);
	}
	// If withReplies is true, we skip the generateRepliesQuery to include all replies
	
	generateVisibilityQuery(query, user);
	if (user) generateMutedUserQuery(query, user);
	if (user) generateMutedNoteQuery(query, user);
	if (user) generateBlockedUserQuery(query, user);

	// Exclude bots if requested
	if (ps.excludeBots) {
		query.andWhere('user.isBot = false');
	}

	// Handle renotes
	if (!ps.withRenotes) {
		query.andWhere('note.renoteId IS NULL');
	}

	// Handle media filtering
	if (ps.withFiles || ps.onlyMedia) {
		query.andWhere('note.fileIds != \'{}\'');
	}

	if (ps.fileType != null) {
		query.andWhere('note.fileIds != \'{}\'');
		query.andWhere(new Brackets((qb: any) => {
			for (const type of ps.fileType!) {
				const i = ps.fileType!.indexOf(type);
				qb.orWhere(`:type${i} = ANY(note.attachedFileTypes)`, { [`type${i}`]: type });
			}
		}));

		if (ps.excludeNsfw) {
			query.andWhere('note.cw IS NULL');
			query.andWhere('0 = (SELECT COUNT(*) FROM drive_file df WHERE df.id = ANY(note."fileIds") AND df."isSensitive" = TRUE)');
		}
	}

	// Apply sorting based on the sort parameter
	switch (ps.sort) {
		case 'trending':
			// Sort by engagement (replies + renotes + reactions)
			query.addSelect('(note.repliesCount + note.renotesCount + note.score)', 'engagement')
				.orderBy('engagement', 'DESC')
				.addOrderBy('note.createdAt', 'DESC');
			break;
		case 'hot':
			// Sort by recent activity with score
			query.addSelect('note.score')
				.andWhere('note.createdAt > :hotDate', { 
					hotDate: new Date(Date.now() - (1000 * 60 * 60 * 24 * 7)) // Last 7 days
				})
				.andWhere('note.score > 0')
				.orderBy('note.score', 'DESC')
				.addOrderBy('note.createdAt', 'DESC');
			break;
		case 'chronological':
		default:
			// Default chronological order
			query.orderBy('note.createdAt', 'DESC');
			break;
	}
	//#endregion

	const timeline = await query.take(ps.limit).getMany();

	process.nextTick(() => {
		if (user) {
			activeUsersChart.read(user);
		}
	});

	return await Notes.packMany(timeline, user);
});
