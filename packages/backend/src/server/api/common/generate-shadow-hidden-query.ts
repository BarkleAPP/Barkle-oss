import { User } from '@/models/entities/user.js';
import { Users } from '@/models/index.js';
import { SelectQueryBuilder, Brackets } from 'typeorm';

/**
 * Generate query to filter out shadow-hidden notes and notes from/to shadow-banned users
 * 
 * Shadow ban rules:
 * - Hide notes where shadowHidden = true
 * - Hide notes from users with reputationScore = 0
 * - Hide replies TO users with reputationScore = 0
 * 
 * Exceptions:
 * - Users can always see their own content
 */
export function generateShadowHiddenQuery(query: SelectQueryBuilder<any>, me: User | null): void {
	// Subquery to check if replyUserId is shadow-banned
	const shadowBannedReplyTargetSubquery = Users.createQueryBuilder('shadowCheckUser')
		.select('shadowCheckUser.id')
		.where('shadowCheckUser.reputationScore = 0');

	if (me) {
		query.andWhere(new Brackets(qb => {
			// Allow if user is the author
			qb.where('note.userId = :meId', { meId: me.id });

			// OR allow if note passes all shadow checks
			qb.orWhere(new Brackets(innerQb => {
				// Note is not shadow hidden
				innerQb.andWhere('note.shadowHidden = false');
				// Author is not shadow-banned
				innerQb.andWhere('(user.reputationScore IS NULL OR user.reputationScore != 0)');
				// Reply target (if exists) is not shadow-banned
				innerQb.andWhere(new Brackets(replyQb => {
					replyQb.where('note.replyUserId IS NULL');
					replyQb.orWhere(`note.replyUserId NOT IN (${shadowBannedReplyTargetSubquery.getQuery()})`);
				}));
			}));
		}));
	} else {
		// For non-logged-in users
		query.andWhere('note.shadowHidden = false');
		query.andWhere('(user.reputationScore IS NULL OR user.reputationScore != 0)');
		query.andWhere(new Brackets(replyQb => {
			replyQb.where('note.replyUserId IS NULL');
			replyQb.orWhere(`note.replyUserId NOT IN (${shadowBannedReplyTargetSubquery.getQuery()})`);
		}));
	}
}
