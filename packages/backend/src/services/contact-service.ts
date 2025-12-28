import { In } from 'typeorm';
import * as crypto from 'crypto';
import { ContactImports, Users, UserProfiles } from '@/models/index.js';
import type { User } from '@/models/entities/user.js';
import type { ContactImport } from '@/models/entities/contact-import.js';

export interface ContactData {
	identifier: string; // phone or email
	name?: string;
}

export interface ContactMatch {
	contact: ContactImport;
	user: User;
}

export class ContactService {
	/**
	 * Hash a contact identifier (phone or email) using SHA-256 for privacy
	 */
	private hashContact(identifier: string): string {
		// Normalize identifier before hashing
		const normalized = this.normalizeIdentifier(identifier);
		return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
	}

	/**
	 * Normalize contact identifiers for consistent hashing
	 */
	private normalizeIdentifier(identifier: string): string {
		// Remove all whitespace and convert to lowercase
		let normalized = identifier.replace(/\s/g, '').toLowerCase();

		// If it looks like a phone number, remove non-digits except +
		if (this.isPhoneNumber(normalized)) {
			normalized = normalized.replace(/[^\d+]/g, '');
			// Ensure country code is included (assume +1 for US if missing)
			if (normalized.length === 10 && /^\d{10}$/.test(normalized)) {
				normalized = '+1' + normalized;
			}
		}

		return normalized;
	}

	/**
	 * Check if identifier looks like a phone number
	 */
	private isPhoneNumber(identifier: string): boolean {
		// Simple heuristic: contains mostly digits and possibly +, -, (, ), spaces
		return /^[\d\s\-\(\)\+]{7,}$/.test(identifier) && /\d{7,}/.test(identifier);
	}

	/**
	 * Import contacts for a user and find matches
	 */
	async importAndMatchContacts(userId: string, contacts: ContactData[]): Promise<ContactMatch[]> {
		const matches: ContactMatch[] = [];

		// Process each contact
		for (const contact of contacts) {
			try {
				const hashedContact = this.hashContact(contact.identifier);

				// Create or get existing contact import record
				const contactImport = await ContactImports.createContact(
					userId,
					hashedContact,
					contact.name,
				);

				if (!contactImport) continue;

				// Look for matches if not already matched
				if (!contactImport.isMatched) {
					const matchedUser = await this.findMatchingUser(hashedContact, userId);
					if (matchedUser) {
						await ContactImports.matchContact(contactImport.id, matchedUser.id);
						contactImport.isMatched = true;
						contactImport.matchedUserId = matchedUser.id;
						contactImport.matchedUser = matchedUser;

						matches.push({
							contact: contactImport,
							user: matchedUser,
						});
					}
				} else if (contactImport.matchedUser) {
					// Already matched
					matches.push({
						contact: contactImport,
						user: contactImport.matchedUser,
					});
				}
			} catch (error) {
				// Continue with other contacts
			}
		}

		return matches;
	}

	/**
	 * Find a user that has the same hashed contact identifier
	 */
	private async findMatchingUser(hashedContact: string, excludeUserId: string): Promise<User | null> {
		// Look for other users who have imported this same contact hash
		const otherContactImports = await ContactImports.findByHashedContact(hashedContact);

		for (const otherImport of otherContactImports) {
			if (otherImport.userId !== excludeUserId && otherImport.user) {
				return otherImport.user;
			}
		}

		// Also check if any user has this hashed contact as their email
		// We need to hash all user emails and compare
		const userProfiles = await UserProfiles.createQueryBuilder('profile')
			.innerJoin('profile.user', 'user')
			.where('profile.email IS NOT NULL')
			.andWhere('user.id != :excludeUserId', { excludeUserId })
			.addSelect(['user.id', 'user.username', 'user.name'])
			.getMany();

		for (const profile of userProfiles) {
			if (profile.email) {
				const userEmailHash = this.hashContact(profile.email);
				if (userEmailHash === hashedContact) {
					// Get the full user object
					const user = await Users.findOneBy({ id: profile.userId });
					if (user) {
						return user;
					}
				}
			}
		}

		return null;
	}

	/**
	 * Check if a hash might represent an email (heuristic)
	 */
	private isEmailHash(hash: string): boolean {
		// This is a placeholder - in practice you'd need more sophisticated logic
		// or store metadata about what type of contact each hash represents
		return false;
	}

	/**
	 * Get contact matches for a user
	 */
	async getContactMatches(userId: string): Promise<ContactMatch[]> {
		const matchedContacts = await ContactImports.findMatchedByUserId(userId);

		return matchedContacts
			.filter((contact: ContactImport) => contact.matchedUser)
			.map((contact: ContactImport) => ({
				contact,
				user: contact.matchedUser!,
			}));
	}

	/**
	 * Get count of contact matches for a user
	 */
	async getContactMatchCount(userId: string): Promise<number> {
		return ContactImports.getContactMatchCount(userId);
	}

	/**
	 * Get social graph recommendations based on contacts of contacts (2nd-degree connections).
	 * Suggests users who are contacts of the user's own contacts.
	 */
	async getSocialGraphRecommendations(userId: string, limit = 20): Promise<User[]> {
		// Get user's 1st-degree connections (their matched contacts)
		const firstDegreeMatches = await this.getContactMatches(userId);
		const firstDegreeUserIds = new Set(firstDegreeMatches.map(match => match.user.id));
		firstDegreeUserIds.add(userId); // Add self to exclusion list

		// Find 2nd-degree connections
		const recommendationScores = new Map<string, { user: User; score: number }>();

		for (const match of firstDegreeMatches) {
			const friendId = match.user.id;
			// Get the contacts of this contact
			const secondDegreeMatches = await this.getContactMatches(friendId);

			for (const secondMatch of secondDegreeMatches) {
				const recommendedUser = secondMatch.user;
				// Exclude 1st-degree contacts and self
				if (!firstDegreeUserIds.has(recommendedUser.id)) {
					const existing = recommendationScores.get(recommendedUser.id);
					if (existing) {
						existing.score++;
					} else {
						recommendationScores.set(recommendedUser.id, { user: recommendedUser, score: 1 });
					}
				}
			}
		}

		// Sort recommendations by score (number of mutual connections)
		const sortedRecs = [...recommendationScores.values()].sort((a, b) => b.score - a.score);

		return sortedRecs.map(rec => rec.user).slice(0, limit);
	}

	/**
	 * Find users who share one or more contacts with the given user.
	 */
	async findMutualContacts(userId: string, limit = 10): Promise<User[]> {
		const userContacts = await ContactImports.findByUserId(userId);
		const userContactHashes = userContacts.map(c => c.hashedContact);

		if (userContactHashes.length === 0) {
			return [];
		}

		// Find other users who have imported the same contacts
		const mutualImports = await ContactImports.createQueryBuilder('import')
			.where('import.hashedContact IN (:...userContactHashes)', { userContactHashes })
			.andWhere('import.userId != :userId', { userId })
			.select(['import.userId', 'COUNT(import.userId) as mutualCount'])
			.groupBy('import.userId')
			.orderBy('mutualCount', 'DESC')
			.limit(limit)
			.getRawMany();

		if (mutualImports.length === 0) {
			return [];
		}

		const mutualUserIds = mutualImports.map(i => i.userId);
		return Users.find({ where: { id: In(mutualUserIds) } });
	}

	/**
	 * Find potential new matches when a user joins
	 * This should be called when a new user registers
	 */
	async findNewMatchesForUser(newUserId: string): Promise<ContactMatch[]> {
		const newMatches: ContactMatch[] = [];

		// Get the new user's profile to check their email
		const newUserProfile = await UserProfiles.findOneBy({ userId: newUserId });
		const newUser = await Users.findOneBy({ id: newUserId });

		if (!newUser || !newUserProfile?.email) {
			return newMatches;
		}

		// Hash the new user's email
		const newUserEmailHash = this.hashContact(newUserProfile.email);

		// Find all contact imports that match this email hash
		const matchingContacts = await ContactImports.findByHashedContact(newUserEmailHash);

		for (const contact of matchingContacts) {
			if (contact.userId !== newUserId && !contact.isMatched) {
				// This contact import now has a match!
				await ContactImports.matchContact(contact.id, newUserId);

				// Reload the contact with the matched user
				const updatedContact = await ContactImports.findByIdWithRelations(contact.id);

				if (updatedContact && updatedContact.user) {
					newMatches.push({
						contact: updatedContact,
						user: newUser,
					});
				}
			}
		}

		return newMatches;
	}

	/**
	 * Trigger friend discovery notifications for new matches
	 * This should be called after findNewMatchesForUser
	 */
	async notifyNewMatches(matches: ContactMatch[]): Promise<void> {
		// Group matches by the user who will receive the notification
		const matchesByUser = new Map<string, ContactMatch[]>();

		for (const match of matches) {
			const userId = match.contact.userId;
			if (!matchesByUser.has(userId)) {
				matchesByUser.set(userId, []);
			}
			matchesByUser.get(userId)!.push(match);
		}

		// Send notifications to each user
		for (const [userId, userMatches] of matchesByUser) {
			// TODO: Create notification when notification system is extended
			// For now, just log the matches found
			// await createNotification(userId, 'contactJoined', {
			//   matches: userMatches.map(m => ({
			//     id: m.user.id,
			//     username: m.user.username,
			//     name: m.user.name,
			//   })),
			// });
		}
	}
}
