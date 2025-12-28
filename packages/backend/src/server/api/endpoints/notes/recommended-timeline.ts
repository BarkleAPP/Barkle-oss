import { Brackets } from 'typeorm';
import { fetchMeta } from '@/misc/fetch-meta.js';
import { Notes } from '@/models/index.js';
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
import { SocialProofService } from '@/services/social-proof-service.js';
import { DAY } from '@/const.js';

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
		rtlDisabled: {
			message: 'Recommended timeline has been disabled.',
			code: 'RTL_DISABLED',
			id: '45a6eb02-7695-4393-b023-dd3be9aaaefe',
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
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
		sinceId: { type: 'string', format: 'barkle:id' },
		untilId: { type: 'string', format: 'barkle:id' },
		sinceDate: { type: 'integer' },
		untilDate: { type: 'integer' },
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const m = await fetchMeta();
	if (m.disableRecommendedTimeline) {
		if (user == null || (!user.isAdmin && !user.isModerator)) {
			throw new ApiError(meta.errors.rtlDisabled);
		}
	}

	//#region Construct query
	const query = makePaginationQuery(Notes.createQueryBuilder('note'),
		ps.sinceId, ps.untilId, ps.sinceDate, ps.untilDate)
		.andWhere(`(note.userHost = ANY ('{"${m.recommendedInstances.join('","')}"}'))`)
		.andWhere('(note.visibility = \'public\')')
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
	generateRepliesQuery(query, user);
	generateVisibilityQuery(query, user);
	if (user) generateMutedUserQuery(query, user);
	if (user) generateMutedNoteQuery(query, user);
	if (user) generateBlockedUserQuery(query, user);

	if (ps.withFiles) {
		query.andWhere('note.fileIds != \'{}\'');
	}

	if (ps.fileType != null) {
		query.andWhere('note.fileIds != \'{}\'');
		query.andWhere(new Brackets(qb => {
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
	//#endregion

	// Get recommended timeline notes
	const recommendedNotes = await query.take(Math.ceil(ps.limit * 0.7)).getMany();

	// Get trending notes to mix in (30% of the timeline)
	const trendingCount = Math.floor(ps.limit * 0.3);
	let trendingNotes: any[] = [];
	
	if (trendingCount > 0) {
		try {
			// Get trending notes from the last 24 hours
			const trendingQuery = Notes.createQueryBuilder('note')
				.where('note.createdAt > :cutoff', { cutoff: new Date(Date.now() - DAY) })
				.andWhere('note.visibility = :visibility', { visibility: 'public' })
				.andWhere('note.localOnly = false')
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
				.leftJoinAndSelect('renoteUser.banner', 'renoteUserBanner')
				.addSelect('(note.renoteCount + COALESCE((SELECT COUNT(*) FROM note_reaction WHERE "noteId" = note.id), 0) + note.repliesCount)', 'engagement')
				.orderBy('engagement', 'DESC')
				.addOrderBy('note.createdAt', 'DESC');

			// Apply same filters as recommended timeline
			generateChannelQuery(trendingQuery, user);
			generateRepliesQuery(trendingQuery, user);
			generateVisibilityQuery(trendingQuery, user);
			if (user) generateMutedUserQuery(trendingQuery, user);
			if (user) generateMutedNoteQuery(trendingQuery, user);
			if (user) generateBlockedUserQuery(trendingQuery, user);

			trendingNotes = await trendingQuery.take(trendingCount).getMany();
		} catch (error) {
			console.error('Failed to fetch trending notes for recommended timeline:', error);
		}
	}

	// Combine and shuffle the notes to create a mixed timeline
	const combinedNotes = [...recommendedNotes];
	
	// Insert trending notes at strategic positions
	if (trendingNotes.length > 0) {
		const insertPositions = [2, 5, 8, 11, 14]; // Strategic positions to insert trending content
		trendingNotes.forEach((trendingNote, index) => {
			const position = insertPositions[index % insertPositions.length] + Math.floor(index / insertPositions.length) * 15;
			if (position < combinedNotes.length) {
				combinedNotes.splice(position, 0, trendingNote);
			} else {
				combinedNotes.push(trendingNote);
			}
		});
	}

	// Limit to requested amount
	const timeline = combinedNotes.slice(0, ps.limit);

	process.nextTick(() => {
		if (user) {
			activeUsersChart.read(user);
		}
	});

	// Pack notes with social proof metadata
	const packedNotes = await Notes.packMany(timeline, user);
	
	// Add social proof indicators to trending notes
	if (user && trendingNotes.length > 0) {
		const socialProofMap = await SocialProofService.batchCalculateNoteSocialProof(
			trendingNotes.map(n => n.id), 
			user.id
		);
		
		packedNotes.forEach((note: any) => {
			const socialProof = socialProofMap.get(note.id);
			if (socialProof) {
				note.socialProof = socialProof;
			}
		});
	}

	return packedNotes;
});
