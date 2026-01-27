import { UserMusicIntegrations } from '@/models/index.js';
import { getSpotifyCurrentlyPlaying } from '@/services/spotify-api.js';
import { getLastfmCurrentlyPlaying } from '@/services/lastfm-api.js';
import { publishNowPlayingStream } from '@/services/stream.js';
import { NowPlayingSong } from '@/server/api/stream/types.js';

const PULL_INTERVAL = 15 * 1000; // 15 seconds

const lastPlayedCache = new Map<string, string | null>();

async function tick() {
    try {
        const integrations = await UserMusicIntegrations.find();

        for (const integration of integrations) {
            let nowPlaying: NowPlayingSong | null = null;
            try {
                if (integration.service === 'spotify') {
                    nowPlaying = await getSpotifyCurrentlyPlaying(integration);
                } else if (integration.service === 'lastfm') {
                    nowPlaying = await getLastfmCurrentlyPlaying(integration);
                }
            } catch (e) {
                continue;
            }

            const lastPlayed = lastPlayedCache.get(integration.userId);
            const currentSongId = nowPlaying ? `${nowPlaying.artist} - ${nowPlaying.title}` : null;

            if (lastPlayed !== currentSongId) {
                publishNowPlayingStream(integration.userId, 'song', nowPlaying);
                lastPlayedCache.set(integration.userId, currentSongId);
            }
        }
    } catch (error) {
        // Silently continue on error
    }
}

export default function () {
	// Run immediately first
	tick();

	// Then run every 15 seconds
	setInterval(tick, PULL_INTERVAL);
}
