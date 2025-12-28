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
        console.error('Spotify client ID or secret not configured.');
        return null;
    }

    if (!integration.refreshToken) {
        console.error(`No refresh token for user ${integration.userId}`);
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
        console.error(`Failed to refresh Spotify token for user ${integration.userId}:`, error);
        // If refresh fails (e.g., token revoked), we should probably delete the integration
        await UserMusicIntegrations.delete(integration.id);
        return null;
    }
}

export async function getSpotifyCurrentlyPlaying(integration: UserMusicIntegration): Promise<NowPlayingSong | null> {
    console.log(`Getting Spotify currently playing for user ${integration.userId}`);
    let accessToken = integration.accessToken;

    // Check if token is expired
    if (integration.expiresAt && new Date() > integration.expiresAt) {
        console.log(`Access token expired for user ${integration.userId}, refreshing...`);
        const newAccessToken = await refreshToken(integration);
        if (!newAccessToken) {
            console.log(`Failed to refresh token for user ${integration.userId}`);
            return null;
        }
        accessToken = newAccessToken;
        console.log(`Token refreshed successfully for user ${integration.userId}`);
    }

    try {
        console.log(`Making Spotify API request for user ${integration.userId}`);
        const response = await getResponse({
            url: `${SPOTIFY_API_URL}/me/player/currently-playing`,
            method: 'GET',
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        console.log(`Spotify API response status: ${response.status} for user ${integration.userId}`);

        if (response.status === 204) {
            console.log(`No content from Spotify API for user ${integration.userId} - nothing is playing`);
            return null; // No content, nothing is playing
        }

        const song = await response.json();
        console.log(`Spotify API response data for user ${integration.userId}:`, song);

        if (!song || !song.item) {
            console.log(`No song data from Spotify API for user ${integration.userId}`);
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

        console.log(`Returning Spotify now playing for user ${integration.userId}:`, result);
        return result;
    } catch (error: any) {
        console.error(`Error fetching Spotify data for user ${integration.userId}:`, error);
        if (error.response && error.response.status === 401) {
            // Token expired, try refreshing
            console.log(`401 error, trying token refresh for user ${integration.userId}`);
            const newAccessToken = await refreshToken(integration);
            if (!newAccessToken) return null;
            // Retry the request with the new token
            return getSpotifyCurrentlyPlaying({ ...integration, accessToken: newAccessToken });
        }
        return null;
    }
}
