import config from '@/config/index.js';
import define from '../define.js';

export const meta = {
	tags: ['meta'],

	requireCredential: false,
	requireCredentialPrivateMode: true,
} as const;

export const paramDef = {
	type: 'object',
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async () => {
	try {
		const response = await fetch('https://repo.Avunite.dev/api/v4/projects/1/releases', {
			signal: AbortSignal.timeout(5000), // 5 second timeout
		});

		if (!response.ok) {
			// If the release server is unavailable, return current version
			return { tag_name: config.version };
		}

		const data = await response.json();
		const tag_name = data[0]?.tag_name ?? config.version;

		return { tag_name };
	} catch {
		// If fetch fails (network error, timeout, etc.), return current version
		return { tag_name: config.version };
	}
});
