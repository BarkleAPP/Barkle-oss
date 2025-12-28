import Koa from 'koa';
import Router from '@koa/router';
import { OAuth2 } from 'oauth';
import { v4 as uuid } from 'uuid';
import { IsNull } from 'typeorm';
import { getJson } from '@/misc/fetch.js';
import config from '@/config/index.js';
import { publishMainStream } from '@/services/stream.js';
import { fetchMeta } from '@/misc/fetch-meta.js';
import { Users, UserMusicIntegrations, UserProfiles } from '@/models/index.js';
import { ILocalUser } from '@/models/entities/user.js';
import { redisClient } from '../../../db/redis.js';
import { genId } from '@/misc/gen-id.js';

function getUserToken(ctx: Koa.BaseContext): string | null {
	return ((ctx.headers['cookie'] || '').match(/igi=(\w+)/) || [null, null])[1];
}

function compareOrigin(ctx: Koa.BaseContext): boolean {
	function normalizeUrl(url?: string): string {
		return url ? url.endsWith('/') ? url.substr(0, url.length - 1) : url : '';
	}

	const referer = ctx.headers['referer'];

	return (normalizeUrl(referer) === normalizeUrl(config.url));
}

const router = new Router();

router.get('/disconnect/spotify', async ctx => {
	if (!compareOrigin(ctx)) {
		ctx.throw(400, 'invalid origin');
		return;
	}

	const userToken = getUserToken(ctx);
	if (!userToken) {
		ctx.throw(400, 'signin required');
		return;
	}

	const user = await Users.findOneByOrFail({
		host: IsNull(),
		token: userToken,
	});

	await UserMusicIntegrations.delete({ userId: user.id, service: 'spotify' });

	const profile = await UserProfiles.findOneByOrFail({ userId: user.id });
	delete profile.integrations.spotify;
	await UserProfiles.update(user.id, {
		integrations: profile.integrations,
	});

	ctx.body = 'Spotify disconnected';

	publishMainStream(user.id, 'meUpdated', await Users.pack(user, user, {
		detail: true,
		includeSecrets: true,
	}));
});

async function getOAuth2() {
	const meta = await fetchMeta(true);

	if (meta.enableSpotifyIntegration) {
		return new OAuth2(
			meta.spotifyClientId!,
			meta.spotifyClientSecret!,
			'https://accounts.spotify.com/',
			'authorize',
			'api/token',
			null
		);
	} else {
		return null;
	}
}

router.get('/connect/spotify', async ctx => {
	if (!compareOrigin(ctx)) {
		ctx.throw(400, 'invalid origin');
		return;
	}

	const userToken = getUserToken(ctx);
	if (!userToken) {
		ctx.throw(400, 'signin required');
		return;
	}

	const params = {
		redirect_uri: `${config.url}/api/spotify/cb`,
		scope: 'user-read-playback-state user-read-currently-playing',
		state: uuid(),
		response_type: 'code',
	};

	redisClient.set(userToken, JSON.stringify(params));

	const oauth2 = await getOAuth2();
	ctx.redirect(oauth2!.getAuthorizeUrl(params));
});

router.get('/spotify/cb', async ctx => {
	const userToken = getUserToken(ctx);
	if (!userToken) {
		ctx.throw(400, 'invalid session');
		return;
	}

	const oauth2 = await getOAuth2();
	if (!oauth2) {
		ctx.throw(400, 'spotify integration disabled');
		return;
	}

	const code = ctx.query.code;
	if (!code || typeof code !== 'string') {
		ctx.throw(400, 'invalid session');
		return;
	}

	const { redirect_uri, state } = await new Promise<any>((res, rej) => {
		redisClient.get(userToken, async (_, state) => {
			res(JSON.parse(state));
		});
	});

	if (ctx.query.state !== state) {
		ctx.throw(400, 'invalid session');
		return;
	}

	const { accessToken, refreshToken, expires_in } = await new Promise<any>((res, rej) =>
		oauth2.getOAuthAccessToken(code, {
			grant_type: 'authorization_code',
			redirect_uri,
		}, (err, accessToken, refreshToken, result) => {
			if (err) {
				rej(err);
			} else if (result.error) {
				rej(result.error);
			} else {
				res({ accessToken, refreshToken, expires_in: result.expires_in });
			}
		}));

	const expiresAt = new Date(Date.now() + expires_in * 1000);

	const spotifyUser = (await getJson('https://api.spotify.com/v1/me', '*/*', 10 * 1000, {
		'Authorization': `Bearer ${accessToken}`,
	})) as Record<string, any>;

	const user = await Users.findOneByOrFail({
		host: IsNull(),
		token: userToken,
	});

	const integration = {
		id: genId(),
		userId: user.id,
		service: 'spotify' as const,
		externalUserId: spotifyUser.id,
		username: spotifyUser.display_name,
		accessToken: accessToken,
		refreshToken: refreshToken,
		expiresAt: expiresAt,
	};

	await UserMusicIntegrations.upsert(integration, ['userId', 'service']);

	const profile = await UserProfiles.findOneByOrFail({ userId: user.id });
	profile.integrations.spotify = {
		id: spotifyUser.id,
		username: spotifyUser.display_name,
	};
	await UserProfiles.update(user.id, {
		integrations: profile.integrations,
	});

	ctx.body = `Spotify: ${spotifyUser.display_name} を、barkle: @${user.username} に接続しました！`;

	publishMainStream(user.id, 'meUpdated', await Users.pack(user, user, {
		detail: true,
		includeSecrets: true,
	}));
});

export default router;
