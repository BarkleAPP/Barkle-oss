import { Users, Followings, ContactImports, Mutings, Blockings } from '@/models/index.js';
import { SocialProofService } from '@/services/social-proof-service.js';
import { ContactInferenceService } from '@/services/contact-inference-service.js';
import define from '../../define.js';
import { DAY } from '@/const.js';

export const meta = {
	tags: ['users'],

	requireCredential: true,

	kind: 'read:account',

	description: 'Show users that the authenticated user might be interested to follow.',

	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			optional: false, nullable: false,
			ref: 'UserDetailed',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
		offset: { type: 'integer', default: 0 },
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	try {
		// Get users I'm already following to exclude them
		const myFollowings = await Followings.find({
			where: { followerId: me.id },
			select: ['followeeId'],
		}).catch(() => []);
		const followingIds = myFollowings.map((f: any) => f.followeeId);

		// Get users I'm muting to exclude them
		const myMutings = await Mutings.find({
			where: { muterId: me.id },
			select: ['muteeId'],
		}).catch(() => []);
		const mutedIds = myMutings.map((m: any) => m.muteeId);

		// Get users I'm blocking to exclude them
		const myBlockings = await Blockings.find({
			where: { blockerId: me.id },
			select: ['blockeeId'],
		}).catch(() => []);
		const blockedIds = myBlockings.map((b: any) => b.blockeeId);

		// Get users who are blocking me to exclude them
		const blockingMe = await Blockings.find({
			where: { blockeeId: me.id },
			select: ['blockerId'],
		}).catch(() => []);
		const blockingMeIds = blockingMe.map((b: any) => b.blockerId);

		// Get contact matches for prioritization (safe handling if no contacts)
		let contactMatches: any[] = [];
		let contactUserIds: string[] = [];
		try {
			contactMatches = await ContactImports.findMatchedByUserId(me.id);
			contactUserIds = contactMatches.map((contact: any) => contact.matchedUserId).filter(Boolean);
		} catch (error) {
			console.warn('[Recommendation] Failed to get contact matches:', error);
			contactMatches = [];
			contactUserIds = [];
		}

		// Get INFERRED contacts (even if user hasn't shared contacts)
		let inferredRecommendations: any[] = [];
		let inferredUserIds: string[] = [];
		const inferredConfidenceMap = new Map<string, number>();
		try {
			inferredRecommendations = await ContactInferenceService.getInferredFriendRecommendations(me.id, 50);
			inferredUserIds = inferredRecommendations.map(r => r.userId);
			for (const rec of inferredRecommendations) {
				inferredConfidenceMap.set(rec.userId, rec.confidence);
			}
		} catch (error) {
			console.warn('[Recommendation] Failed to get inferred contacts:', error);
		}

		// Get second-degree connections (contacts of contacts) for social graph
		const secondDegreeUserIds: string[] = [];
		const mutualContactCounts = new Map<string, number>();

		// Only fetch second-degree if we have direct contacts
		if (contactUserIds.length > 0) {
			try {
				for (const contactUserId of contactUserIds) {
					try {
						const contactsOfContact = await ContactImports.findMatchedByUserId(contactUserId);
						for (const secondContact of contactsOfContact) {
							if (secondContact.matchedUserId &&
								secondContact.matchedUserId !== me.id &&
								!contactUserIds.includes(secondContact.matchedUserId)) {
								secondDegreeUserIds.push(secondContact.matchedUserId);
								// Track mutual contact count
								mutualContactCounts.set(
									secondContact.matchedUserId,
									(mutualContactCounts.get(secondContact.matchedUserId) || 0) + 1
								);
							}
						}
					} catch (error) {
						console.warn(`[Recommendation] Failed to get contacts for user ${contactUserId}:`, error);
						continue;
					}
				}
			} catch (error) {
				console.warn('[Recommendation] Failed to build second-degree network:', error);
			}
		}

		// Combine all IDs to exclude
		const excludeIds = [me.id, ...followingIds, ...mutedIds, ...blockedIds, ...blockingMeIds].filter(Boolean);

		// Build query using ORM
		const query = Users.createQueryBuilder('user')
			.where('user.isLocked = :isLocked', { isLocked: false })
			.andWhere('user.isExplorable = :isExplorable', { isExplorable: true })
			.andWhere('user.host IS NULL')
			.andWhere('user.updatedAt >= :date', { date: new Date(Date.now() - (7 * DAY)) })
			.orderBy('user.followersCount', 'DESC');

		// Exclude unwanted users
		if (excludeIds.length > 0) {
			query.andWhere('user.id NOT IN (:...excludeIds)', { excludeIds });
		}

		// Add social graph priority scoring (Instagram-style)
		if (contactUserIds.length > 0 || secondDegreeUserIds.length > 0) {
			// Priority: 0 = direct contact, 1 = 2nd degree, 2 = other
			const allRelevantIds = [...contactUserIds, ...secondDegreeUserIds];
			query.addSelect(
				`CASE 
				WHEN user.id = ANY(:contactIds) THEN 0 
				WHEN user.id = ANY(:secondDegreeIds) THEN 1 
				ELSE 2 
			END`,
				'social_graph_priority'
			);
			query.setParameter('contactIds', contactUserIds.length > 0 ? contactUserIds : ['']);
			query.setParameter('secondDegreeIds', secondDegreeUserIds.length > 0 ? secondDegreeUserIds : ['']);
			query.addOrderBy('social_graph_priority', 'ASC');
		}

		const users = await query.take(ps.limit * 2).skip(ps.offset).getMany();

		// Calculate mutual connections and social proof using ORM
		const usersWithProof = await Promise.all(users.map(async (user: any) => {
			const isContactMatch = contactUserIds.includes(user.id);
			const isSecondDegree = secondDegreeUserIds.includes(user.id);
			const mutualContactCount = mutualContactCounts.get(user.id) || 0;

			// Check if this is an INFERRED contact
			const isInferred = inferredUserIds.includes(user.id);
			const inferredConfidence = inferredConfidenceMap.get(user.id) || 0;

			// Calculate mutual following connections using ORM
			const mutualFollowingConnections = await Followings.createQueryBuilder('f1')
				.innerJoin('following', 'f2', 'f1.followeeId = f2.followerId')
				.where('f1.followerId = :meId', { meId: me.id })
				.andWhere('f2.followeeId = :userId', { userId: user.id })
				.getCount();

			// Get comprehensive social proof data
			const userSocialProof = await SocialProofService.calculateUserSocialProof(user.id, me.id);

			return {
				...user,
				socialProof: {
					...userSocialProof,
					isContactMatch,
					isSecondDegree,
					mutualContactCount,
					mutualFollowingConnections,
					// Add inference data
					isInferred,
					inferredConfidence,
				},
			};
		}));

		// Sort by social graph relevance with inference support
		const sortedUsers = usersWithProof.sort((a, b) => {
			// 1. Direct contacts first
			if (a.socialProof.isContactMatch && !b.socialProof.isContactMatch) return -1;
			if (!a.socialProof.isContactMatch && b.socialProof.isContactMatch) return 1;

			// 2. High-confidence inferred contacts
			if (a.socialProof.isInferred && !b.socialProof.isInferred) {
				if (a.socialProof.inferredConfidence >= 0.8) return -1;
			}
			if (!a.socialProof.isInferred && b.socialProof.isInferred) {
				if (b.socialProof.inferredConfidence >= 0.8) return 1;
			}

			// 3. Second-degree connections
			if (a.socialProof.isSecondDegree && !b.socialProof.isSecondDegree) return -1;
			if (!a.socialProof.isSecondDegree && b.socialProof.isSecondDegree) return 1;

			// 4. Sort by mutual contact count
			return (b.socialProof.mutualContactCount || 0) - (a.socialProof.mutualContactCount || 0);
		});

		return await Users.packMany(sortedUsers.slice(0, ps.limit), me, { detail: true });
	} catch (error) {
		console.error('[Recommendation] Fatal error:', error);
		// Fallback to simple active users recommendation
		try {
			const fallbackUsers = await Users.createQueryBuilder('user')
				.where('user.id != :meId', { meId: me.id })
				.andWhere('user.isLocked = :isLocked', { isLocked: false })
				.andWhere('user.isExplorable = :isExplorable', { isExplorable: true })
				.andWhere('user.host IS NULL')
				.andWhere('user.updatedAt >= :date', { date: new Date(Date.now() - (7 * DAY)) })
				.orderBy('user.followersCount', 'DESC')
				.take(ps.limit)
				.skip(ps.offset)
				.getMany();

			return await Users.packMany(fallbackUsers, me, { detail: true });
		} catch (fallbackError) {
			console.error('[Recommendation] Fallback also failed:', fallbackError);
			return [];
		}
	}
});