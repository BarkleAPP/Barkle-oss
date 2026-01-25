import Parser from 'rss-parser';
import { getResponse } from '@/misc/fetch.js';
import config from '@/config/index.js';
import define from '../define.js';
import { ApiError } from '../error.js';

const rssParser = new Parser();

/**
 * SSRF protection: Validates URL to prevent access to internal resources
 */
function isValidRssUrl(urlString: string): boolean {
	try {
		const url = new URL(urlString);

		if (url.protocol !== 'http:' && url.protocol !== 'https:') {
			return false;
		}

		const hostname = url.hostname.toLowerCase();

		const blockedHostnames = [
			'localhost', '127.0.0.1', '0.0.0.0', '[::1]',
			'localhost.localdomain', 'ip6-localhost', 'ip6-loopback',
		];

		if (blockedHostnames.includes(hostname)) {
			return false;
		}

		const privateIpPatterns = [
			/^10\./, /^172\.(1[6-9]|2[0-9]|3[0-1])\./, /^192\.168\./,
			/^127\./, /^169\.254\./, /^fc00:/i, /^fe80:/i, /^::1$/i, /^::$/,
		];

		for (const pattern of privateIpPatterns) {
			if (pattern.test(hostname)) {
				return false;
			}
		}

		const blockedEndpoints = [
			'metadata', '169.254.169.254', 'metadata.google.internal', 'instance-data',
		];

		if (blockedEndpoints.some(endpoint => hostname.includes(endpoint))) {
			return false;
		}

		return true;
	} catch {
		return false;
	}
}

export const meta = {
	tags: ['meta'],

	requireCredential: false,
	allowGet: true,
	cacheSec: 60 * 3,

	errors: {
		invalidUrl: {
			message: 'Invalid URL',
			code: 'INVALID_URL',
			id: 'b3c7c7c8-9d5e-4f3a-8c6d-9e5f4a3b2c1d',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		url: { type: 'string' },
	},
	required: ['url'],
} as const;

export default define(meta, paramDef, async (ps) => {
	if (!isValidRssUrl(ps.url)) {
		throw new ApiError(meta.errors.invalidUrl);
	}

	const res = await getResponse({
		url: ps.url,
		method: 'GET',
		headers: Object.assign({
			'User-Agent': config.userAgent,
			Accept: 'application/rss+xml, */*',
		}),
		timeout: 5000,
	});

	const text = await res.text();

	return rssParser.parseString(text);
});

