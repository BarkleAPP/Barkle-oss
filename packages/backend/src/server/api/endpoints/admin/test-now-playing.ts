import define from '../../define.js';
import { UserMusicIntegrations } from '@/models/index.js';
import { getSpotifyCurrentlyPlaying } from '@/services/spotify-api.js';
import { publishNowPlayingStream } from '@/services/stream.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireAdmin: true,

	res: {
		type: 'object',
		optional: false, nullable: false,
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	console.log('Manual now playing test triggered by admin');
	
	const integrations = await UserMusicIntegrations.find();
	console.log(`Found ${integrations.length} integrations:`, integrations.map(i => ({
		userId: i.userId,
		service: i.service,
		username: i.username,
		hasAccessToken: !!i.accessToken,
		hasRefreshToken: !!i.refreshToken,
		expiresAt: i.expiresAt
	})));
	
	const results = [];
	
	for (const integration of integrations) {
		try {
			let nowPlaying = null;
			if (integration.service === 'spotify') {
				nowPlaying = await getSpotifyCurrentlyPlaying(integration);
			}
			
			if (nowPlaying) {
				console.log(`Found now playing for user ${integration.userId}:`, nowPlaying);
				publishNowPlayingStream(integration.userId, 'song', nowPlaying);
			}
			
			results.push({
				userId: integration.userId,
				service: integration.service,
				nowPlaying
			});
		} catch (error) {
			console.error(`Error for user ${integration.userId}:`, error);
			results.push({
				userId: integration.userId,
				service: integration.service,
				error: error instanceof Error ? error.message : String(error)
			});
		}
	}
	
	return {
		integrations: integrations.length,
		results
	};
});
