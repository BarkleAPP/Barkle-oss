import { In, LessThan } from 'typeorm';
import { ContactDegreeOfSeparation } from '../entities/contact-degree-separation.js';
import { db } from '@/db/postgre.js';
import { genId } from '@/misc/gen-id.js';

export const ContactDegreeOfSeparationRepository = db.getRepository(ContactDegreeOfSeparation).extend({
    /**
     * Find or create a degree of separation record
     */
    async findOrCreate(
        sourceUserId: string,
        targetUserId: string,
        degree: number,
        path: string[],
    ): Promise<ContactDegreeOfSeparation> {
        let record = await this.findOne({
            where: {
                sourceUserId,
                targetUserId,
            },
        });

        if (!record) {
            record = this.create({
                id: genId(),
                sourceUserId,
                targetUserId,
                degreeOfSeparation: degree,
                connectionPath: path,
                pathCount: 1,
                connectionStrength: this.calculateConnectionStrength(degree, 1),
                metadata: null,
                lastVerified: new Date(),
            });

            await this.save(record);
        }

        return record;
    },

    /**
     * Update a degree of separation record with additional path
     */
    async updateWithNewPath(
        sourceUserId: string,
        targetUserId: string,
        degree: number,
        newPath: string[],
    ): Promise<void> {
        const record = await this.findOne({
            where: { sourceUserId, targetUserId },
        });

        if (record) {
            // If we found a shorter path, update degree
            if (degree < record.degreeOfSeparation) {
                record.degreeOfSeparation = degree;
                record.connectionPath = newPath;
            }

            // Increment path count (multiple connections strengthen the relationship)
            record.pathCount += 1;
            record.connectionStrength = this.calculateConnectionStrength(
                record.degreeOfSeparation,
                record.pathCount,
            );
            record.lastVerified = new Date();

            await this.save(record);
        }
    },

    /**
     * Get all connections for a user up to a certain degree
     */
    async getConnectionsByDegree(
        userId: string,
        maxDegree: number,
    ): Promise<ContactDegreeOfSeparation[]> {
        return this.find({
            where: {
                sourceUserId: userId,
                degreeOfSeparation: LessThan(maxDegree + 1),
            },
            order: {
                degreeOfSeparation: 'ASC',
                connectionStrength: 'DESC',
            },
        });
    },

    /**
     * Get connections at a specific degree
     */
    async getConnectionsAtDegree(
        userId: string,
        degree: number,
    ): Promise<ContactDegreeOfSeparation[]> {
        return this.find({
            where: {
                sourceUserId: userId,
                degreeOfSeparation: degree,
            },
            order: {
                connectionStrength: 'DESC',
            },
        });
    },

    /**
     * Get the degree of separation between two users
     */
    async getDegree(sourceUserId: string, targetUserId: string): Promise<number | null> {
        const record = await this.findOne({
            where: { sourceUserId, targetUserId },
            select: ['degreeOfSeparation'],
        });

        return record?.degreeOfSeparation ?? null;
    },

    /**
     * Get mutual connections between two users
     */
    async getMutualConnections(userId1: string, userId2: string): Promise<string[]> {
        // Get 1st degree connections for both users
        const user1Connections = await this.find({
            where: {
                sourceUserId: userId1,
                degreeOfSeparation: 1,
            },
            select: ['targetUserId'],
        });

        const user2Connections = await this.find({
            where: {
                sourceUserId: userId2,
                degreeOfSeparation: 1,
            },
            select: ['targetUserId'],
        });

        const user1Set = new Set(user1Connections.map(c => c.targetUserId));
        const user2Set = new Set(user2Connections.map(c => c.targetUserId));

        // Find intersection
        return [...user1Set].filter(id => user2Set.has(id));
    },

    /**
     * Build social graph spider web for a user
     * Returns a map of userId -> degree
     */
    async buildSocialGraphWeb(userId: string, maxDegree = 3): Promise<Map<string, number>> {
        const web = new Map<string, number>();

        const connections = await this.getConnectionsByDegree(userId, maxDegree);

        for (const connection of connections) {
            web.set(connection.targetUserId, connection.degreeOfSeparation);
        }

        return web;
    },

    /**
     * Calculate connection strength based on degree and path count
     */
    calculateConnectionStrength(degree: number, pathCount: number): number {
        // Strength decreases with degree but increases with multiple paths
        const degreeWeight = 1 / degree;
        const pathBonus = Math.log10(pathCount + 1) * 0.5;
        return Math.min(degreeWeight + pathBonus, 1.0);
    },

    /**
     * Clean up stale connections that haven't been verified in a while
     */
    async cleanupStaleConnections(daysOld = 90): Promise<number> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);

        const result = await this.delete({
            lastVerified: LessThan(cutoffDate),
        });

        return result.affected || 0;
    },

    /**
     * Get strongest connections for recommendations
     */
    async getStrongestConnections(
        userId: string,
        limit = 50,
    ): Promise<ContactDegreeOfSeparation[]> {
        return this.find({
            where: {
                sourceUserId: userId,
            },
            order: {
                connectionStrength: 'DESC',
                degreeOfSeparation: 'ASC',
            },
            take: limit,
        });
    },
});
