/**
 * API Server
 */

import Koa from 'koa';
import Router from '@koa/router';
import multer from '@koa/multer';
import bodyParser from 'koa-bodyparser';
import { AccessTokens, Users } from '@/models/index.js';
import config from '@/config/index.js';
import endpoints from './endpoints.js';
import compatibility from './compatibility.js';
import handler from './api-handler.js';
import signup from './private/signup.js';
import signin from './private/signin.js';
import signupPending from './private/signup-pending.js';
import discord from './service/discord.js';
import github from './service/github.js';
import twitter from './service/twitter.js';
import spotify from './service/spotify.js';
import { createCorsMiddleware } from '@/misc/security/cors-config.js';

// Init app
const app = new Koa();

// Global error handler - catches all unhandled errors and formats them as JSON
// This MUST be the first middleware to catch errors from all subsequent middleware
app.use(async (ctx, next) => {
	try {
		await next();
	} catch (err: any) {
		// Log the error for debugging
		console.error(`[API Server Error] ${ctx.method} ${ctx.path}:`, err);

		// Determine appropriate status code
		ctx.status = err.statusCode || err.status || 500;

		// Format error as JSON response
		ctx.body = {
			error: {
				message: err.expose ? err.message : 'Internal server error',
				code: err.code || 'INTERNAL_ERROR',
				id: err.id || '5d37dbcb-891e-41ca-a3d6-e690c97775ac',
				kind: ctx.status >= 500 ? 'server' : 'client',
			},
		};
	}
});

// Apply secure CORS configuration
app.use(createCorsMiddleware(config));

// No caching
app.use(async (ctx, next) => {
	ctx.set('Cache-Control', 'private, max-age=0, must-revalidate');
	await next();
});

app.use(bodyParser({
	// リクエストが multipart/form-data でない限りはJSONだと見なす
	detectJSON: ctx => !(
		ctx.is('multipart/form-data') ||
		ctx.is('application/x-www-form-urlencoded')
	),
}));

// Init multer instance
const upload = multer({
	storage: multer.diskStorage({}),
	limits: {
		fileSize: config.maxFileSize || 262144000,
		files: 1,
	},
});

// Init router
const router = new Router();

/**
 * Register endpoint handlers
 */
for (const endpoint of [...endpoints, ...compatibility]) {
	if (endpoint.meta.requireFile) {
		router.post(`/${endpoint.name}`, upload.single('file'), handler.bind(null, endpoint));
	} else {
		// 後方互換性のため
		if (endpoint.name.includes('-')) {
			router.post(`/${endpoint.name.replace(/-/g, '_')}`, handler.bind(null, endpoint));

			if (endpoint.meta.allowGet) {
				router.get(`/${endpoint.name.replace(/-/g, '_')}`, handler.bind(null, endpoint));
			} else {
				router.get(`/${endpoint.name.replace(/-/g, '_')}`, async ctx => { ctx.status = 405; });
			}
		}

		router.post(`/${endpoint.name}`, handler.bind(null, endpoint));

		if (endpoint.meta.allowGet) {
			router.get(`/${endpoint.name}`, handler.bind(null, endpoint));
		} else {
			router.get(`/${endpoint.name}`, async ctx => { ctx.status = 405; });
		}
	}
}

router.post('/signup', signup);
router.post('/signin', signin);
router.post('/signup-pending', signupPending);

router.use(discord.routes());
router.use(github.routes());
router.use(twitter.routes());
router.use(spotify.routes());

router.post('/miauth/:session/check', async ctx => {
	const token = await AccessTokens.findOneBy({
		session: ctx.params.session,
	});

	if (token && token.session != null && !token.fetched) {
		AccessTokens.update(token.id, {
			fetched: true,
		});

		ctx.body = {
			ok: true,
			token: token.token,
			user: await Users.pack(token.userId, null, { detail: true }),
		};
	} else {
		ctx.body = {
			ok: false,
		};
	}
});

// Return 404 for unknown API
router.all('(.*)', async ctx => {
	ctx.status = 404;
});

// Register router
app.use(router.routes());
app.use(router.allowedMethods());

export default app;