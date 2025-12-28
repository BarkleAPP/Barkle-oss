import { ContactImports, Users, ContactDegreeOfSeparations, UserAlgorithmPreferences } from '@/models/index.js';
import { genId } from '@/misc/gen-id.js';
import * as crypto from 'crypto';

/**
 * Contact Inference Engine
 * Infers user data and relationships from cross-user contact patterns
 * Similar to how LinkedIn/Facebook suggests connections
 */
export class ContactInferenceService {
    /**
     * Minimum confidence threshold (0-1) to consider an inference valid
     */
    private static readonly MIN_CONFIDENCE_THRESHOLD = 0.6;

    /**
     * Minimum number of users who must have the same contact data
     */
    private static readonly MIN_CONSENSUS_COUNT = 3;

    /**
     * Infer missing contact data for a user based on what others have stored
     * Returns inferred contacts with confidence scores
     */
    static async inferUserContactData(userId: string): Promise<
        Array<{
            hashedIdentifier: string;
            inferredName: string | null;
            inferredEmail: string | null;
            inferredPhone: string | null;
            confidence: number;
            sourceCount: number;
            sources: string[];
        }>
    > {
        try {
            // Get the user's verified identifiers to cross-reference
            const user = await Users.findOneBy({ id: userId });
            if (!user) return [];

            const userIdentifiers = new Set<string>();

            // Hash user's known identifiers
            if (user.email) {
                userIdentifiers.add(this.hashIdentifier(user.email));
            }
            if (user.usernameLower) {
                userIdentifiers.add(this.hashIdentifier(user.usernameLower));
            }

            // Find contacts that match this user's identifiers across all users
            const matchingContacts = await ContactImports.createQueryBuilder('contact')
                .where('contact.hashedContact IN (:...hashes)', {
                    hashes: Array.from(userIdentifiers)
                })
                .getMany();

            if (matchingContacts.length === 0) return [];

            // Group by hashed identifier to find consensus
            const consensusMap = new Map<
                string,
                {
                    names: Map<string, number>;
                    importers: Set<string>;
                    hashedIdentifier: string;
                }
            >();

            for (const contact of matchingContacts) {
                if (!consensusMap.has(contact.hashedContact)) {
                    consensusMap.set(contact.hashedContact, {
                        names: new Map(),
                        importers: new Set(),
                        hashedIdentifier: contact.hashedContact,
                    });
                }

                const consensus = consensusMap.get(contact.hashedContact)!;

                if (contact.contactName) {
                    const nameCount = consensus.names.get(contact.contactName) || 0;
                    consensus.names.set(contact.contactName, nameCount + 1);
                }

                consensus.importers.add(contact.userId);
            }

            // Calculate confidence and build inferences
            const inferences: Array<{
                hashedIdentifier: string;
                inferredName: string | null;
                inferredEmail: string | null;
                inferredPhone: string | null;
                confidence: number;
                sourceCount: number;
                sources: string[];
            }> = [];

            for (const [hashedId, data] of consensusMap.entries()) {
                if (data.importers.size < this.MIN_CONSENSUS_COUNT) continue;

                // Find most common name (consensus)
                let mostCommonName: string | null = null;
                let maxNameCount = 0;

                for (const [name, count] of data.names.entries()) {
                    if (count > maxNameCount) {
                        maxNameCount = count;
                        mostCommonName = name;
                    }
                }

                // Calculate confidence based on consensus
                const confidence = maxNameCount / data.importers.size;

                if (confidence >= this.MIN_CONFIDENCE_THRESHOLD) {
                    inferences.push({
                        hashedIdentifier: hashedId,
                        inferredName: mostCommonName,
                        inferredEmail: null, // Can be inferred if we track it
                        inferredPhone: null, // Can be inferred if we track it
                        confidence,
                        sourceCount: data.importers.size,
                        sources: Array.from(data.importers).slice(0, 10), // Limit for privacy
                    });
                }
            }

            return inferences;
        } catch (error) {
            console.error('[ContactInference] Failed to infer user contact data:', error);
            return [];
        }
    }

    /**
     * Infer a user's contacts even if they haven't imported any
     * Based on who has them in their contacts
     */
    static async inferUserContactList(userId: string): Promise<
        Array<{
            matchedUserId: string;
            confidence: number;
            sourceCount: number;
            inferredRelationship: string;
        }>
    > {
        try {
            const user = await Users.findOneBy({ id: userId });
            if (!user) return [];

            // Find all users who have this user in their contacts
            const userIdentifiers = new Set<string>();

            if (user.email) {
                userIdentifiers.add(this.hashIdentifier(user.email));
            }
            if (user.usernameLower) {
                userIdentifiers.add(this.hashIdentifier(user.usernameLower));
            }

            if (userIdentifiers.size === 0) return [];

            // Find who has this user as a contact
            const whoHasUser = await ContactImports.createQueryBuilder('contact')
                .where('contact.hashedContact IN (:...hashes)', {
                    hashes: Array.from(userIdentifiers)
                })
                .andWhere('contact.userId != :userId', { userId })
                .getMany();

            if (whoHasUser.length === 0) return [];

            // Get the importers (people who have this user)
            const importerIds = [...new Set(whoHasUser.map(c => c.userId))];

            // Now find contacts that those importers ALSO have
            // These are likely mutual contacts
            const mutualContactCandidates = await ContactImports.createQueryBuilder('contact')
                .where('contact.userId IN (:...importerIds)', { importerIds })
                .andWhere('contact.isMatched = :matched', { matched: true })
                .andWhere('contact.matchedUserId != :userId', { userId })
                .andWhere('contact.matchedUserId IS NOT NULL')
                .getMany();

            // Count frequency of each matched user (more = higher confidence)
            const candidateScores = new Map<
                string,
                {
                    count: number;
                    sources: Set<string>;
                }
            >();

            for (const candidate of mutualContactCandidates) {
                if (!candidate.matchedUserId) continue;

                if (!candidateScores.has(candidate.matchedUserId)) {
                    candidateScores.set(candidate.matchedUserId, {
                        count: 0,
                        sources: new Set(),
                    });
                }

                const score = candidateScores.get(candidate.matchedUserId)!;
                score.count++;
                score.sources.add(candidate.userId);
            }

            // Build inferred contact list
            const inferredContacts: Array<{
                matchedUserId: string;
                confidence: number;
                sourceCount: number;
                inferredRelationship: string;
            }> = [];

            for (const [matchedUserId, data] of candidateScores.entries()) {
                if (data.count < this.MIN_CONSENSUS_COUNT) continue;

                // Confidence based on how many people have both users
                const confidence = Math.min(data.count / whoHasUser.length, 1.0);

                if (confidence >= this.MIN_CONFIDENCE_THRESHOLD) {
                    inferredContacts.push({
                        matchedUserId,
                        confidence,
                        sourceCount: data.sources.size,
                        inferredRelationship: this.inferRelationshipType(confidence, data.count),
                    });
                }
            }

            // Sort by confidence
            inferredContacts.sort((a, b) => b.confidence - a.confidence);

            return inferredContacts;
        } catch (error) {
            console.error('[ContactInference] Failed to infer user contact list:', error);
            return [];
        }
    }

    /**
     * Find users who are likely the same person based on contact patterns
     * (e.g., multiple people have "John Doe" with same phone/email)
     */
    static async findLikelyUserMatches(
        hashedIdentifier: string,
    ): Promise<
        Array<{
            userId: string;
            confidence: number;
            evidenceCount: number;
            matchingIdentifiers: string[];
        }>
    > {
        try {
            // Find all contact entries with this hashed identifier
            const matches = await ContactImports.find({
                where: { hashedContact: hashedIdentifier },
            });

            if (matches.length < this.MIN_CONSENSUS_COUNT) return [];

            // Group by matched user ID
            const userMatches = new Map<
                string,
                {
                    count: number;
                    names: Set<string>;
                    sources: Set<string>;
                }
            >();

            for (const match of matches) {
                if (!match.matchedUserId) continue;

                if (!userMatches.has(match.matchedUserId)) {
                    userMatches.set(match.matchedUserId, {
                        count: 0,
                        names: new Set(),
                        sources: new Set(),
                    });
                }

                const data = userMatches.get(match.matchedUserId)!;
                data.count++;
                if (match.contactName) data.names.add(match.contactName);
                data.sources.add(match.userId);
            }

            // Calculate confidence for each candidate
            const results: Array<{
                userId: string;
                confidence: number;
                evidenceCount: number;
                matchingIdentifiers: string[];
            }> = [];

            for (const [userId, data] of userMatches.entries()) {
                const confidence = data.count / matches.length;

                if (confidence >= this.MIN_CONFIDENCE_THRESHOLD) {
                    results.push({
                        userId,
                        confidence,
                        evidenceCount: data.count,
                        matchingIdentifiers: Array.from(data.names),
                    });
                }
            }

            return results.sort((a, b) => b.confidence - a.confidence);
        } catch (error) {
            console.error('[ContactInference] Failed to find likely user matches:', error);
            return [];
        }
    }

    /**
     * Create inferred contact imports for a user based on cross-referencing
     * This fills in their contact list even if they haven't shared contacts
     */
    static async createInferredContactImports(userId: string): Promise<number> {
        try {
            const inferredContacts = await this.inferUserContactList(userId);

            let created = 0;

            for (const inferred of inferredContacts) {
                // Check if this relationship already exists
                const existing = await ContactImports.findOne({
                    where: {
                        userId,
                        matchedUserId: inferred.matchedUserId,
                    },
                });

                if (existing) continue;

                // Create an inferred contact import
                const contact = ContactImports.create({
                    id: genId(),
                    userId,
                    hashedContact: `inferred_${inferred.matchedUserId}`,
                    contactName: null,
                    source: 'inference',
                    isMatched: true,
                    matchedUserId: inferred.matchedUserId,
                });

                await ContactImports.save(contact);

                // Also create degree of separation entry
                await ContactDegreeOfSeparations.findOrCreate(
                    userId,
                    inferred.matchedUserId,
                    1, // Consider inferred contacts as 1st degree
                    [userId, inferred.matchedUserId],
                );

                created++;
            }

            return created;
        } catch (error) {
            console.error('[ContactInference] Failed to create inferred imports:', error);
            return 0;
        }
    }

    /**
     * Get friend recommendations based on contact inference
     * Includes confidence scores and reasoning
     */
    static async getInferredFriendRecommendations(
        userId: string,
        limit = 20,
    ): Promise<
        Array<{
            userId: string;
            confidence: number;
            reason: string;
            sourceCount: number;
        }>
    > {
        try {
            const inferredContacts = await this.inferUserContactList(userId);

            return inferredContacts.slice(0, limit).map(contact => ({
                userId: contact.matchedUserId,
                confidence: contact.confidence,
                reason: `${contact.sourceCount} of your contacts have this person in their contacts`,
                sourceCount: contact.sourceCount,
            }));
        } catch (error) {
            console.error('[ContactInference] Failed to get recommendations:', error);
            return [];
        }
    }

    /**
     * Update algorithm preferences with inferred contact data
     */
    static async updateAlgorithmWithInferredContacts(userId: string): Promise<void> {
        try {
            const inferred = await this.inferUserContactList(userId);

            if (inferred.length === 0) return;

            // Build contact matches map with confidence scores
            const inferredContactMatches: Record<string, any> = {};
            const inferredSecondDegree: Record<string, number> = {};

            for (const contact of inferred) {
                if (contact.confidence >= 0.8) {
                    // High confidence = treat as direct contact
                    inferredContactMatches[contact.matchedUserId] = {
                        degree: 1,
                        confidence: contact.confidence,
                        inferred: true,
                    };
                } else if (contact.confidence >= 0.6) {
                    // Medium confidence = second degree
                    inferredSecondDegree[contact.matchedUserId] = contact.sourceCount;
                }
            }

            // Update user algorithm preferences
            await UserAlgorithmPreferences.updateLearnings(userId, {
                contactMatches: inferredContactMatches,
                secondDegreeConnections: inferredSecondDegree,
            });
        } catch (error) {
            console.error('[ContactInference] Failed to update algorithm preferences:', error);
        }
    }

    /**
     * Infer relationship type based on confidence and frequency
     */
    private static inferRelationshipType(confidence: number, count: number): string {
        if (confidence >= 0.9 && count >= 10) return 'close_friend';
        if (confidence >= 0.8 && count >= 5) return 'friend';
        if (confidence >= 0.7 && count >= 3) return 'acquaintance';
        return 'potential_contact';
    }

    /**
     * Hash an identifier for privacy
     */
    private static hashIdentifier(identifier: string): string {
        return crypto.createHash('sha256').update(identifier.toLowerCase().trim()).digest('hex');
    }

    /**
     * Get inference statistics for monitoring
     */
    static async getInferenceStats(): Promise<{
        totalInferredContacts: number;
        usersWithInferences: number;
        averageConfidence: number;
    }> {
        try {
            const inferredContacts = await ContactImports.count({
                where: { source: 'inference' },
            });

            const usersWithInferences = await ContactImports.createQueryBuilder('contact')
                .where("contact.source = 'inference'")
                .select('DISTINCT contact.userId')
                .getRawMany();

            return {
                totalInferredContacts: inferredContacts,
                usersWithInferences: usersWithInferences.length,
                averageConfidence: 0.75, // Would calculate from stored data
            };
        } catch (error) {
            console.error('[ContactInference] Failed to get stats:', error);
            return {
                totalInferredContacts: 0,
                usersWithInferences: 0,
                averageConfidence: 0,
            };
        }
    }
}
