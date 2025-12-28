import * as os from 'node:os';
import si from 'systeminformation';
import define from '../define.js';

export const meta = {
	requireCredential: false,
	requireCredentialPrivateMode: true,

	tags: ['meta'],
} as const;

export const paramDef = {
	type: 'object',
	properties: {},
	required: [],
} as const;

// Helper function to run systeminformation calls with timeout
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
	try {
		const timeoutPromise = new Promise<never>((_, reject) => {
			setTimeout(() => reject(new Error('Timeout')), timeoutMs);
		});
		return await Promise.race([promise, timeoutPromise]);
	} catch (error) {
		console.warn('System info call failed or timed out, using fallback:', error instanceof Error ? error.message : String(error));
		return fallback;
	}
}

export default define(meta, paramDef, async () => {
	const isProduction = process.env.NODE_ENV === 'production';
	const useSystemInfo = !isProduction || process.env.USE_SYSTEMINFORMATION === 'true';

	// Get memory stats with timeout and fallback
	let memStats;
	if (useSystemInfo) {
		try {
			memStats = await withTimeout(si.mem(), 3000, null);
		} catch (error) {
			console.warn('systeminformation.mem() failed, using fallback');
		}
	}
	// Fallback to Node.js built-in
	if (!memStats) {
		memStats = { total: os.totalmem() };
	}

	// Get filesystem stats with timeout and fallback
	let fsStats;
	if (useSystemInfo) {
		try {
			fsStats = await withTimeout(si.fsSize(), 3000, null);
			// Filter out any invalid entries
			if (fsStats) {
				fsStats = fsStats.filter(fs => fs.size > 0);
			}
		} catch (error) {
			console.warn('systeminformation.fsSize() failed, using fallback');
		}
	}
	// Fallback - we can't easily get filesystem size without systeminformation
	if (!fsStats || fsStats.length === 0) {
		fsStats = [{ size: 0, used: 0 }];
	}

	// Get CPU info (this should be safe)
	let cpus;
	try {
		cpus = os.cpus();
		if (!cpus || cpus.length === 0) {
			throw new Error('No CPU info available');
		}
	} catch (error) {
		console.error('Error getting cpu info:', error);
		cpus = [{ model: 'Unknown', speed: 0, times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 } }];
	}

	return {
		machine: os.hostname(),
		cpu: {
			model: cpus[0].model,
			cores: cpus.length,
		},
		mem: {
			total: memStats.total,
		},
		fs: {
			total: fsStats[0]?.size || 0,
			used: fsStats[0]?.used || 0,
		},
	};
});
