import { Notes, NoteReactions, Users } from '@/models/index.js';
import { SocialProofService } from '@/services/social-proof-service.js';
import { MoreThan } from 'typeorm';
import { HOUR, DAY } from '@/const.js';
import define from '../../define.js';

export const meta = {
	tags: ['activity', 'social-proof'],

	requireCredential: false,

	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: {
			platform: {
				type: 'object',
				properties: {
					activeUsers: { type: 'number' },
					recentNotes: { type: 'number' },
					recentEngagement: { type: 'number' },
					trendingTopics: { type: 'array', items: { type: 'string' } },
				},
			},
			personal: {
				type: 'object',
				nullable: true,
				properties: {
					friendsActive: { type: 'number' },
					missedInteractions: { type: 'number' },
					newFollowers: { type: 'number' },
					engagementReceived: { type: 'number' },
				},
			},
		},
	},

	description: 'Get real-time activity indicators for social proof',
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		timeframe: { 
			type: 'string', 
			enum: ['1h', '6h', '24h'], 
			default: '24h',
			description: 'Timeframe for activity calculation'
		},
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const timeframeMs = ps.timeframe === '1h' ? HOUR : 
		ps.timeframe === '6h' ? 6 * HOUR : DAY;
	const cutoff = new Date(Date.now() - timeframeMs);

	// Platform-wide activity indicators
	const [activeUsers, recentNotes, recentEngagement] = await Promise.all([
		// Count users who posted or reacted recently
		Users.createQueryBuilder('user')
			.leftJoin('note', 'note', 'note.userId = user.id AND note.createdAt > :cutoff', { cutoff })
			.leftJoin('note_reaction', 'reaction', 'reaction.userId = user.id AND reaction.createdAt > :cutoff', { cutoff })
			.where('note.id IS NOT NULL OR reaction.id IS NOT NULL')
			.getCount(),
		
		// Count recent notes
		Notes.count({
			where: { createdAt: MoreThan(cutoff) },
		}),
		
		// Count recent reactions
		NoteReactions.count({
			where: { createdAt: MoreThan(cutoff) },
		}),
	]);

	// Get trending topics (simplified - using hashtags from recent notes)
	const trendingNotes = await Notes.find({
		where: { createdAt: MoreThan(cutoff) },
		select: ['tags'],
		take: 100,
	});
	
	const tagCounts = new Map<string, number>();
	trendingNotes.forEach(note => {
		note.tags.forEach(tag => {
			tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
		});
	});
	
	const trendingTopics = Array.from(tagCounts.entries())
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5)
		.map(([tag]) => tag);

	const platformActivity = {
		activeUsers,
		recentNotes,
		recentEngagement,
		trendingTopics,
	};

	// Personal activity indicators (if user is authenticated)
	let personalActivity = null;
	if (user) {
		// Get user's following list for friend activity
		const following = await Users.createQueryBuilder('user')
			.innerJoin('following', 'f', 'f.followeeId = user.id')
			.where('f.followerId = :userId', { userId: user.id })
			.select(['user.id'])
			.getMany();
		
		const followingIds = following.map(u => u.id);

		if (followingIds.length > 0) {
			const [friendsActive, newFollowers, engagementReceived] = await Promise.all([
				// Count friends who were active recently
				Notes.createQueryBuilder('note')
					.where('note.userId IN (:...followingIds)', { followingIds })
					.andWhere('note.createdAt > :cutoff', { cutoff })
					.select('DISTINCT note.userId')
					.getRawMany()
					.then(results => results.length),
				
				// Count new followers
				Users.createQueryBuilder('user')
					.innerJoin('following', 'f', 'f.followerId = user.id')
					.where('f.followeeId = :userId', { userId: user.id })
					.andWhere('f.createdAt > :cutoff', { cutoff })
					.getCount(),
				
				// Count engagement received on user's recent notes
				Notes.createQueryBuilder('note')
					.leftJoin('note_reaction', 'reaction', 'reaction.noteId = note.id AND reaction.createdAt > :cutoff', { cutoff })
					.leftJoin('note', 'renote', 'renote.renoteId = note.id AND renote.createdAt > :cutoff', { cutoff })
					.leftJoin('note', 'reply', 'reply.replyId = note.id AND reply.createdAt > :cutoff', { cutoff })
					.where('note.userId = :userId', { userId: user.id })
					.andWhere('note.createdAt > :noteCutoff', { noteCutoff: new Date(Date.now() - (7 * DAY)) })
					.select('COUNT(DISTINCT reaction.id) + COUNT(DISTINCT renote.id) + COUNT(DISTINCT reply.id)', 'engagement')
					.getRawOne()
					.then(result => parseInt(result.engagement) || 0),
			]);

			// Count missed interactions (notifications user hasn't seen)
			const missedInteractions = await NoteReactions.createQueryBuilder('reaction')
				.innerJoin('note', 'note', 'note.id = reaction.noteId')
				.where('note.userId = :userId', { userId: user.id })
				.andWhere('reaction.createdAt > :cutoff', { cutoff })
				.getCount();

			personalActivity = {
				friendsActive,
				missedInteractions,
				newFollowers,
				engagementReceived,
			};
		}
	}

	return {
		platform: platformActivity,
		personal: personalActivity,
	};
});