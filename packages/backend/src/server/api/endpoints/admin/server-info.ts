import * as os from 'node:os';
import si from 'systeminformation';
import define from '../../define.js';
import { redisClient } from '../../../../db/redis.js';
import { db } from '@/db/postgre.js';

export const meta = {
	requireCredential: true,
	requireModerator: true,

	tags: ['admin', 'meta'],

	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: {
			machine: {
				type: 'string',
				optional: false, nullable: false,
			},
			os: {
				type: 'string',
				optional: false, nullable: false,
				example: 'linux',
			},
			node: {
				type: 'string',
				optional: false, nullable: false,
			},
			psql: {
				type: 'string',
				optional: false, nullable: false,
			},
			cpu: {
				type: 'object',
				optional: false, nullable: false,
				properties: {
					model: {
						type: 'string',
						optional: false, nullable: false,
					},
					cores: {
						type: 'number',
						optional: false, nullable: false,
					},
				},
			},
			mem: {
				type: 'object',
				optional: false, nullable: false,
				properties: {
					total: {
						type: 'number',
						optional: false, nullable: false,
						format: 'bytes',
					},
				},
			},
			fs: {
				type: 'object',
				optional: false, nullable: false,
				properties: {
					total: {
						type: 'number',
						optional: false, nullable: false,
						format: 'bytes',
					},
					used: {
						type: 'number',
						optional: false, nullable: false,
						format: 'bytes',
					},
				},
			},
			net: {
				type: 'object',
				optional: false, nullable: false,
				properties: {
					interface: {
						type: 'string',
						optional: false, nullable: false,
						example: 'eth0',
					},
				},
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async () => {
	// Get system information with error handling
	let memStats;
	try {
		memStats = await si.mem();
	} catch (error) {
		console.error('Error getting memory stats:', error instanceof Error ? error.message : String(error));
		memStats = { total: 0 };
	}

	let fsStats;
	try {
		fsStats = await si.fsSize();
	} catch (error) {
		console.error('Error getting filesystem stats:', error instanceof Error ? error.message : String(error));
		fsStats = [{ size: 0, used: 0 }];
	}

	let netInterface;
	try {
		netInterface = await si.networkInterfaceDefault();
	} catch (error) {
		console.error('Error getting network interface:', error instanceof Error ? error.message : String(error));
		netInterface = 'unknown';
	}

	let redis_version;
	try {
		const redisServerInfo = await redisClient.info('Server');
		const m = redisServerInfo.match(new RegExp('^redis_version:(.*)', 'm'));
		redis_version = m?.[1];
	} catch (error) {
		console.error('Error getting Redis version:', error instanceof Error ? error.message : String(error));
		redis_version = 'unknown';
	}

	let psql_version;
	try {
		// Use parameterized query for version check
		psql_version = await db.query('SHOW server_version').then(x => x[0].server_version);
	} catch (error) {
		console.error('Error getting PostgreSQL version:', error instanceof Error ? error.message : String(error));
		psql_version = 'unknown';
	}

	let cpuInfo;
	try {
		const cpus = os.cpus();
		cpuInfo = {
			model: cpus[0]?.model || 'Unknown',
			cores: cpus.length,
		};
	} catch (error) {
		console.error('Error getting CPU info:', error instanceof Error ? error.message : String(error));
		cpuInfo = {
			model: 'Unknown',
			cores: 0,
		};
	}

	return {
		machine: os.hostname(),
		os: os.platform(),
		node: process.version,
		psql: psql_version,
		redis: redis_version,
		cpu: cpuInfo,
		mem: {
			total: memStats.total,
		},
		fs: {
			total: fsStats[0].size,
			used: fsStats[0].used,
		},
		net: {
			interface: netInterface,
		},
	};
});
