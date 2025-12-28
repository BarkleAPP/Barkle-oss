import define from '../../define.js';
import { fetchMeta } from '@/misc/fetch-meta.js';
import { Metas } from '@/models/index.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireAdmin: true,
} as const;

export const paramDef = {
	type: 'object',
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const instance = await fetchMeta();
	
	if (!instance.mux_token_id || !instance.mux_secret_key) {
		throw new ApiError({
			message: 'Mux API credentials are not configured',
			code: 'MUX_NOT_CONFIGURED',
			id: 'e27c73dd-b5a2-4ebd-aaaa-25d5e4ad3d4f',
		});
	}

	try {
		// Call Mux API to create signing key
		const response = await fetch('https://api.mux.com/system/v1/signing-keys', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Basic ${Buffer.from(`${instance.mux_token_id}:${instance.mux_secret_key}`).toString('base64')}`,
			},
		});

		if (!response.ok) {
			throw new Error(`Mux API error: ${response.status} ${response.statusText}`);
		}

		const data = await response.json();
		
		// Update Meta with signing key information
		await Metas.update({}, {
			mux_signing_key_id: data.data.id,
			mux_signing_key_private: data.data.private_key,
		});

		return {
			id: data.data.id,
			created_at: data.data.created_at,
			// Don't return the private key in the response for security
		};
	} catch (error) {
		throw new ApiError({
			message: `Failed to generate signing key: ${error.message}`,
			code: 'SIGNING_KEY_GENERATION_FAILED',
			id: 'f8e4a8b3-2c1d-4e89-9f6a-7b2c4d5e6f8g',
		});
	}
});
