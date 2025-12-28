import { Notes } from '@/models/index.js';
import { SocialProofService } from '@/services/social-proof-service.js';
import define from '../../define.js';

export const meta = {
	tags: ['notes'],

	requireCredential: false,

	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			optional: false, nullable: false,
			ref: 'Note',
		},
	},

	description: 'Get trending notes with social proof indicators',
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
		timeframe: { 
			type: 'string', 
			enum: ['1h', '6h', '24h', '7d'], 
			default: '24h',
			description: 'Timeframe for trending calculation'
		},
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// Get trending notes with social proof metadata
	const trendingNotes = await SocialProofService.getTrendingNotes(ps.limit, user?.id);
	
	// Pack the notes for response
	return await Notes.packMany(trendingNotes, user);
});