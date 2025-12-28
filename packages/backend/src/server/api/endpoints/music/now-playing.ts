import define from '../../define.js';
import { Users, UserMusicIntegrations } from '@/models/index.js';
import { getSpotifyCurrentlyPlaying } from '@/services/spotify-api.js';
import { getLastfmCurrentlyPlaying } from '@/services/lastfm-api.js';

export const meta = {
	tags: ['music'],

	requireCredential: false,

	params: {
		userId: {
			type: 'string',
		},
	},

	res: {
		type: 'object',
		optional: false,
		nullable: true,
		properties: {
			coverArtUrl: {
				type: 'string',
				optional: false,
				nullable: false,
			},
			title: {
				type: 'string',
				optional: false,
				nullable: false,
			},
			artist: {
				type: 'string',
				optional: false,
				nullable: false,
			},
			album: {
				type: 'string',
				optional: false,
				nullable: false,
			},
			url: {
				type: 'string',
				optional: false,
				nullable: false,
			},
			progressMs: {
				type: 'number',
				optional: false,
				nullable: false,
			},
			durationMs: {
				type: 'number',
				optional: false,
				nullable: false,
			},
			isPlaying: {
				type: 'boolean',
				optional: false,
				nullable: false,
			},
			service: {
				type: 'string',
				optional: false,
				nullable: false,
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		userId: { type: 'string' },
	},
	required: ['userId'],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	// Verify user exists
	const user = await Users.findOneBy({ id: ps.userId });
	if (!user) {
		return null;
	}

	// Get user's music integrations
	const integrations = await UserMusicIntegrations.findBy({ userId: ps.userId });
	
	for (const integration of integrations) {
		try {
			let nowPlaying = null;
			
			if (integration.service === 'spotify') {
				nowPlaying = await getSpotifyCurrentlyPlaying(integration);
			} else if (integration.service === 'lastfm') {
				nowPlaying = await getLastfmCurrentlyPlaying(integration);
			}
			
			// Return the first active playing song found
			if (nowPlaying && nowPlaying.isPlaying) {
				return nowPlaying;
			}
		} catch (error) {
			console.error(`Error getting now playing for ${integration.service}:`, error);
			continue;
		}
	}
	
	return null;
});
