import define from '../../define.js';
import { fetchMeta } from '@/misc/fetch-meta.js';
import { Streams } from '@/models/index.js';
import { ApiError } from '../../error.js';
import * as jsrsasign from 'jsrsasign';

export const meta = {
	tags: ['live'],
	requireCredential: true,
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		streamId: { type: 'string' },
	},
	required: ['streamId'],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	// Check if user owns the stream or is moderator
	const stream = await Streams.findOneBy({ id: ps.streamId });
	if (!stream) {
		throw new ApiError({
			message: 'Stream not found',
			code: 'STREAM_NOT_FOUND',
			id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
		});
	}

	if (stream.userId !== me.id && !me.isModerator) {
		throw new ApiError({
			message: 'Access denied',
			code: 'ACCESS_DENIED',
			id: 'b2c3d4e5-f6g7-8901-bcde-f23456789012',
		});
	}

	const instance = await fetchMeta();
	
	if (!instance.mux_signing_key_id || !instance.mux_signing_key_private) {
		throw new ApiError({
			message: 'Mux signing key is not configured',
			code: 'MUX_SIGNING_KEY_NOT_CONFIGURED',
			id: 'c3d4e5f6-g7h8-9012-cdef-345678901234',
		});
	}

	try {
		// Decode the base64 private key
		const privateKey = Buffer.from(instance.mux_signing_key_private, 'base64').toString('utf-8');
		
		// Create JWT header
		const header = {
			alg: 'RS256',
			typ: 'JWT',
			kid: instance.mux_signing_key_id
		};
		
		// Create JWT payload
		const payload = {
			sub: stream.id, // Mux Live Stream ID (stored as the primary key)
			aud: 'live_stream_id',
			exp: Math.floor(Date.now() / 1000) + (15 * 60), // 15 minutes from now
			iat: Math.floor(Date.now() / 1000)
		};
		
		// Generate JWT using jsrsasign
		const token = jsrsasign.KJUR.jws.JWS.sign('RS256', JSON.stringify(header), JSON.stringify(payload), privateKey);

		// Fetch health stats from Mux
		const response = await fetch(`https://stats.mux.com/live-stream-health?token=${token}`);
		
		if (!response.ok) {
			throw new Error(`Mux Stats API error: ${response.status} ${response.statusText}`);
		}

		const healthData = await response.json();
		
		return {
			data: healthData.data,
			timestamp: new Date().toISOString(),
		};
	} catch (error) {
		throw new ApiError({
			message: `Failed to get stream health: ${error.message}`,
			code: 'STREAM_HEALTH_FETCH_FAILED',
			id: 'd4e5f6g7-h8i9-0123-defg-456789012345',
		});
	}
});
