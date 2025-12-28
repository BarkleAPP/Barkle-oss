import define from '../../define.js';
import { AlgorithmExperiments } from '@/models/index.js';
import Logger from '@/services/logger.js';

const logger = new Logger('algorithm-cleanup-duplicates');

export const meta = {
    tags: ['algorithm'],
    requireCredential: true,
    requireAdmin: true,
} as const;

export const paramDef = {
    type: 'object',
    properties: {},
    required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
    try {
        // Find all experiments
        const allExperiments = await AlgorithmExperiments.find({
            order: {
                startDate: 'ASC',
            },
        });

        // Group by name to find duplicates
        const experimentsByName = new Map<string, typeof allExperiments>();
        for (const exp of allExperiments) {
            const existing = experimentsByName.get(exp.name) || [];
            existing.push(exp);
            experimentsByName.set(exp.name, existing);
        }

        let deletedCount = 0;
        const deleted: string[] = [];

        // For each group of duplicates, keep only the oldest one
        for (const [name, experiments] of experimentsByName.entries()) {
            if (experiments.length > 1) {
                // Sort by creation date (oldest first)
                experiments.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

                // Keep the first (oldest), delete the rest
                const toKeep = experiments[0];
                const toDelete = experiments.slice(1);

                logger.info(`Found ${experiments.length} duplicates of "${name}", keeping ${toKeep.id}, deleting ${toDelete.length} others`);

                for (const exp of toDelete) {
                    await AlgorithmExperiments.delete(exp.id);
                    deleted.push(exp.id);
                    deletedCount++;
                }
            }
        }

        logger.info(`Cleanup complete: deleted ${deletedCount} duplicate experiments`);

        return {
            success: true,
            deletedCount,
            deletedIds: deleted,
            remainingCount: allExperiments.length - deletedCount,
        };
    } catch (error) {
        logger.error('Error cleaning up duplicate experiments:', error as Error);
        throw new Error('Failed to clean up duplicates');
    }
});
