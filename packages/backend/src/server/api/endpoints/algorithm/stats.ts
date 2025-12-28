import define from '../../define.js';
import { algorithmClient } from '@/services/algorithm/algorithm-microservice-client.js';
import Logger from '@/services/logger.js';

const logger = new Logger('algorithm-stats');

export const meta = {
	tags: ['algorithm'],
	requireCredential: true,
	requireAdmin: true,
	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: {
			cache: {
				type: 'object',
				optional: false, nullable: false,
			},
			mmr: {
				type: 'object',
				optional: false, nullable: false,
			},
			quality: {
				type: 'object',
				optional: false, nullable: false,
			},
			precomputation: {
				type: 'object',
				optional: false, nullable: false,
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {},
	required: []
} as const;

export default define(meta, paramDef, async (ps, user) => {
	try {
		// Get comprehensive algorithm statistics
		const stats = algorithmClient.getStats();

		logger.info(`Algorithm stats requested by admin user ${user.id}`);

		return stats;
	} catch (error) {
		logger.error('Error getting algorithm stats:', error as Error);
		
		// Return empty stats on error
		return {
			cache: {},
			mmr: {},
			quality: {},
			precomputation: {}
		};
	}
});