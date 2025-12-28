import { ContactImports, ContactDegreeOfSeparations, UserAlgorithmPreferences } from '@/models/index.js';

/**
 * Spider Web Social Graph Builder
 * Builds and maintains degrees of separation between users through contacts
 */
export class SocialGraphSpiderWebService {
    /**
     * Build the complete spider web for a user up to maxDegree
     * Uses BFS (Breadth-First Search) to find all connections
     */
    static async buildSpiderWeb(userId: string, maxDegree = 3): Promise<void> {
        const visited = new Set<string>();
        const queue: Array<{ userId: string; degree: number; path: string[] }> = [];

        // Start with the user themselves
        visited.add(userId);
        queue.push({ userId, degree: 0, path: [userId] });

        while (queue.length > 0) {
            const current = queue.shift()!;

            // Skip if we've reached max degree
            if (current.degree >= maxDegree) {
                continue;
            }

            // Get direct contacts (1st degree) for current user
            const contacts = await ContactImports.findMatchedByUserId(current.userId);

            for (const contact of contacts) {
                if (!contact.matchedUserId) continue;

                const targetUserId = contact.matchedUserId;

                // Skip if already visited
                if (visited.has(targetUserId)) {
                    // But still update if we found a new path
                    await ContactDegreeOfSeparations.updateWithNewPath(
                        userId,
                        targetUserId,
                        current.degree + 1,
                        [...current.path, targetUserId],
                    );
                    continue;
                }

                visited.add(targetUserId);

                // Create or update degree of separation
                await ContactDegreeOfSeparations.findOrCreate(
                    userId,
                    targetUserId,
                    current.degree + 1,
                    [...current.path, targetUserId],
                );

                // Add to queue for next level
                queue.push({
                    userId: targetUserId,
                    degree: current.degree + 1,
                    path: [...current.path, targetUserId],
                });
            }
        }
    }

    /**
     * Rebuild spider web for all connections when a user imports contacts
     */
    static async rebuildAfterContactImport(userId: string): Promise<void> {
        // Build spider web for this user
        await this.buildSpiderWeb(userId, 3);

        // Also rebuild for users who have this user as a contact (reverse connections)
        const reverseContacts = await ContactImports.createQueryBuilder('contact')
            .where('contact.matchedUserId = :userId', { userId })
            .andWhere('contact.isMatched = :matched', { matched: true })
            .getMany();

        // Rebuild for each user who has this person as a contact
        for (const reverseContact of reverseContacts.slice(0, 10)) {
            // Limit to avoid overload
            await this.buildSpiderWeb(reverseContact.userId, 2);
        }
    }

    /**
     * Get social graph statistics for a user
     */
    static async getSocialGraphStats(userId: string): Promise<{
        firstDegree: number;
        secondDegree: number;
        thirdDegree: number;
        totalConnections: number;
        strongestConnections: string[];
    }> {
        const firstDegree = await ContactDegreeOfSeparations.count({
            where: { sourceUserId: userId, degreeOfSeparation: 1 },
        });

        const secondDegree = await ContactDegreeOfSeparations.count({
            where: { sourceUserId: userId, degreeOfSeparation: 2 },
        });

        const thirdDegree = await ContactDegreeOfSeparations.count({
            where: { sourceUserId: userId, degreeOfSeparation: 3 },
        });

        const strongestConnections = await ContactDegreeOfSeparations.getStrongestConnections(
            userId,
            10,
        );

        return {
            firstDegree,
            secondDegree,
            thirdDegree,
            totalConnections: firstDegree + secondDegree + thirdDegree,
            strongestConnections: strongestConnections.map(c => c.targetUserId),
        };
    }

    /**
     * Get recommended users based on social graph proximity
     */
    static async getSocialGraphRecommendations(
        userId: string,
        limit = 20,
    ): Promise<Array<{ userId: string; degree: number; strength: number }>> {
        const connections = await ContactDegreeOfSeparations.getStrongestConnections(
            userId,
            limit * 2,
        );

        // Filter to 2nd and 3rd degree (not direct contacts)
        const recommendations = connections
            .filter(c => c.degreeOfSeparation >= 2)
            .slice(0, limit)
            .map(c => ({
                userId: c.targetUserId,
                degree: c.degreeOfSeparation,
                strength: c.connectionStrength,
            }));

        return recommendations;
    }

    /**
     * Update algorithm preferences with social graph data
     */
    static async updateAlgorithmPreferencesWithSocialGraph(userId: string): Promise<void> {
        // Get spider web connections
        const web = await ContactDegreeOfSeparations.buildSocialGraphWeb(userId, 3);

        // Build contact matches map
        const contactMatches: Record<string, any> = {};
        const secondDegreeConnections: Record<string, number> = {};

        for (const [targetUserId, degree] of web.entries()) {
            if (degree === 1) {
                contactMatches[targetUserId] = { degree: 1 };
            } else if (degree === 2) {
                // Get mutual contact count
                const mutualContacts = await ContactDegreeOfSeparations.getMutualConnections(
                    userId,
                    targetUserId,
                );
                secondDegreeConnections[targetUserId] = mutualContacts.length;
            }
        }

        // Update user algorithm preferences
        await UserAlgorithmPreferences.updateLearnings(userId, {
            contactMatches,
            secondDegreeConnections,
        });
    }
}
