import { UserMusicIntegrations } from '@/models/index.js';
import { getSpotifyCurrentlyPlaying } from '@/services/spotify-api.js';
import { getLastfmCurrentlyPlaying } from '@/services/lastfm-api.js';
import { publishNowPlayingStream } from '@/services/stream.js';
import { NowPlayingSong } from '@/server/api/stream/types.js';

const PULL_INTERVAL = 15 * 1000; // 15 seconds

const lastPlayedCache = new Map<string, string | null>();

async function tick() {
    console.log('Now playing daemon tick started at:', new Date().toISOString());
    try {
        const integrations = await UserMusicIntegrations.find();
        console.log(`Found ${integrations.length} music integrations:`, integrations.map(i => ({ 
            userId: i.userId, 
            service: i.service, 
            username: i.username,
            expiresAt: i.expiresAt,
            hasAccessToken: !!i.accessToken,
            hasRefreshToken: !!i.refreshToken
        })));

        for (const integration of integrations) {
            console.log(`Processing integration for user ${integration.userId}, service: ${integration.service}`);
            let nowPlaying: NowPlayingSong | null = null;
            try {
                if (integration.service === 'spotify') {
                    console.log('Calling getSpotifyCurrentlyPlaying...');
                    nowPlaying = await getSpotifyCurrentlyPlaying(integration);
                    console.log('Spotify result:', nowPlaying);
                } else if (integration.service === 'lastfm') {
                    console.log('Calling getLastfmCurrentlyPlaying...');
                    nowPlaying = await getLastfmCurrentlyPlaying(integration);
                    console.log('Last.fm result:', nowPlaying);
                }
            } catch (e) {
                console.error(`Failed to fetch now playing for user ${integration.userId} from ${integration.service}:`, e);
                continue; // Skip to the next integration if one fails
            }

            const lastPlayed = lastPlayedCache.get(integration.userId);
            // Create a unique identifier for the current song to compare against the cache
            const currentSongId = nowPlaying ? `${nowPlaying.artist} - ${nowPlaying.title}` : null;

            console.log(`User ${integration.userId}: lastPlayed="${lastPlayed}", currentSongId="${currentSongId}"`);

            if (lastPlayed !== currentSongId) {
                console.log(`Publishing now playing update for user ${integration.userId}:`, nowPlaying);
                publishNowPlayingStream(integration.userId, 'song', nowPlaying);
                lastPlayedCache.set(integration.userId, currentSongId);
                console.log('Published successfully');
            } else {
                console.log(`No change in now playing for user ${integration.userId}`);
            }
        }
    } catch (error) {
        console.error('Error in now playing daemon tick:', error);
    }
    console.log('Now playing daemon tick completed at:', new Date().toISOString());
}

export default function () {
	console.log('Starting now playing daemon...');
	
	// Run immediately first
	tick();
	
	// Then run every 15 seconds
	setInterval(tick, PULL_INTERVAL);
	
	// Also run every 5 seconds for debugging
	setInterval(() => {
		console.log('Debug tick - daemon is alive at:', new Date().toISOString());
	}, 5000);
}
