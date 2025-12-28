import { getJson } from '@/misc/fetch.js';
import { fetchMeta } from '@/misc/fetch-meta.js';
import type { UserMusicIntegration } from '@/models/entities/user-music-integration.js';
import type { NowPlayingSong } from '@/server/api/stream/types.js';

const LASTFM_API_URL = 'https://ws.audioscrobbler.com/2.0/';

async function lastfmApiCall(params: Record<string, string>) {
    const meta = await fetchMeta(true);
    if (!meta.lastfmApiKey) {
        throw new Error('Last.fm API key not configured.');
    }

    const mutableParams = { ...params };
    mutableParams.api_key = meta.lastfmApiKey;
    mutableParams.format = 'json';

    const finalParams = new URLSearchParams(mutableParams);
    const url = `${LASTFM_API_URL}?${finalParams.toString()}`;

    const response = await getJson(url);

    if (response.error) {
        throw new Error(`Last.fm API Error: ${response.message}`);
    }
    return response;
}

export async function getLastfmCurrentlyPlaying(integration: UserMusicIntegration): Promise<NowPlayingSong | null> {
    try {
        console.log(`Fetching Last.fm data for user ${integration.userId}, username: ${integration.username}`);

        const data = await lastfmApiCall({
            method: 'user.getrecenttracks',
            user: integration.username,
            limit: '1',
        });

        console.log('Last.fm API response:', JSON.stringify(data, null, 2));

        if (!data.recenttracks || !data.recenttracks.track) {
            console.log('No recent tracks found for user:', integration.username);
            return null;
        }

        // Last.fm API returns a single object when limit=1, or an array when multiple tracks
        let track = data.recenttracks.track;
        if (Array.isArray(track)) {
            track = track[0];
        }

        if (!track) {
            console.log('No track data found');
            return null;
        }

        console.log('Track data:', JSON.stringify(track, null, 2));

        // Check if the track is currently playing
        if (track['@attr'] && track['@attr'].nowplaying === 'true') {
            // Find the largest image
            let coverArtUrl = '';
            if (track.image && Array.isArray(track.image)) {
                const largeImage = track.image.find((i: any) => i.size === 'extralarge') ||
                    track.image.find((i: any) => i.size === 'large') ||
                    track.image.find((i: any) => i.size === 'medium') ||
                    track.image[track.image.length - 1];
                coverArtUrl = largeImage?.['#text'] || '';
            }

            const result = {
                coverArtUrl,
                title: track.name || 'Unknown Track',
                artist: (typeof track.artist === 'string' ? track.artist : track.artist?.['#text']) || 'Unknown Artist',
                album: (typeof track.album === 'string' ? track.album : track.album?.['#text']) || '',
                url: track.url || '',
                progressMs: 0, // Not available from Last.fm
                durationMs: 0, // Not available from Last.fm
                isPlaying: true,
                service: 'lastfm' as const,
            };
            console.log('Returning Last.fm now playing:', result);
            return result;
        }

        console.log('Track is not currently playing (no @attr.nowplaying)');
        return null;
    } catch (error) {
        console.error(`Error fetching Last.fm data for user ${integration.userId}:`, error);
        return null;
    }
}
