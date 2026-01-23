/**
 * Media Proxy
 */

import Koa from 'koa';
import Router from '@koa/router';
import { proxyMedia } from './proxy-media.js';
import { createCorsMiddleware } from '@/misc/security/cors-config.js';
import config from '@/config/index.js';

// Init app
const app = new Koa();

// Apply secure CORS configuration
app.use(createCorsMiddleware(config));

app.use(async (ctx, next) => {
	ctx.set('Content-Security-Policy', `default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; font-src 'self' data:`);
	await next();
});

// Init router
const router = new Router();

router.get('/:url*', proxyMedia);

// Register router
app.use(router.routes());

export default app;
