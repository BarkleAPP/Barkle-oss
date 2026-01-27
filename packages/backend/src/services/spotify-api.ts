import { getResponse, getJson } from '@/misc/fetch.js';
import { UserMusicIntegrations } from '@/models/index.js';
import { fetchMeta } from '@/misc/fetch-meta.js';
import { NowPlayingSong } from '@/server/api/stream/types.js';
import type { UserMusicIntegration } from '@/models/entities/user-music-integration.js';

const SPOTIFY_API_URL = 'https://api.spotify.com/v1';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

async function refreshToken(integration: UserMusicIntegration): Promise<string | null> {
    const meta = await fetchMeta(true);
    if (!meta.spotifyClientId || !meta.spotifyClientSecret) {
        return null;
    }

    if (!integration.refreshToken) {
        return null;
    }

    try {
        const response = await getResponse({
            url: SPOTIFY_TOKEN_URL,
            method: 'POST',
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: integration.refreshToken,
                client_id: meta.spotifyClientId,
                client_secret: meta.spotifyClientSecret,
            }).toString(),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error_description || data.error);
        }

        const newAccessToken = data.access_token;
        const newExpiresAt = new Date(Date.now() + data.expires_in * 1000);

        await UserMusicIntegrations.update(integration.id, {
            accessToken: newAccessToken,
            expiresAt: newExpiresAt,
        });

        return newAccessToken;
    } catch (error) {
        // If refresh fails (e.g., token revoked), delete the integration
        await UserMusicIntegrations.delete(integration.id);
        return null;
    }
}

export async function getSpotifyCurrentlyPlaying(integration: UserMusicIntegration): Promise<NowPlayingSong | null> {
    let accessToken = integration.accessToken;

    // Check if token is expired
    if (integration.expiresAt && new Date() > integration.expiresAt) {
        const newAccessToken = await refreshToken(integration);
        if (!newAccessToken) {
            return null;
        }
        accessToken = newAccessToken;
    }

    try {
        const response = await getResponse({
            url: `${SPOTIFY_API_URL}/me/player/currently-playing`,
            method: 'GET',
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        if (response.status === 204) {
            return null; // No content, nothing is playing
        }

        const song = await response.json();

        if (!song || !song.item) {
            return null;
        }

        const result = {
            coverArtUrl: song.item.album.images[0]?.url,
            title: song.item.name,
            artist: song.item.artists.map((a: any) => a.name).join(', '),
            album: song.item.album.name,
            url: song.item.external_urls.spotify,
            progressMs: song.progress_ms,
            durationMs: song.item.duration_ms,
            isPlaying: song.is_playing,
            service: 'spotify' as const,
        };

        return result;
    } catch (error: any) {
        if (error.response && error.response.status === 401) {
            // Token expired, try refreshing
            const newAccessToken = await refreshToken(integration);
            if (!newAccessToken) return null;
            // Retry the request with the new token
            return getSpotifyCurrentlyPlaying({ ...integration, accessToken: newAccessToken });
        }
        return null;
    }
}
