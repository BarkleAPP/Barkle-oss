import si from 'systeminformation';
import Xev from 'xev';
import * as osUtils from 'os-utils';

const ev = new Xev();

const interval = 2000;

const roundCpu = (num: number) => Math.round(num * 1000) / 1000;
const round = (num: number) => Math.round(num * 10) / 10;

/**
 * Report server stats regularly
 */
export default function () {
	const log = [] as any[];

	ev.on('requestServerStatsLog', x => {
		ev.emit(`serverStatsLog:${x.id}`, log.slice(0, x.length || 50));
	});

	async function tick() {
		const cpu = await cpuUsage();
		const memStats = await mem();
		const netStats = await net();
		const fsStats = await fs();

		const stats = {
			cpu: roundCpu(cpu),
			mem: {
				used: round(memStats.used - memStats.buffers - memStats.cached),
				active: round(memStats.active),
			},
			net: {
				rx: round(Math.max(0, netStats.rx_sec)),
				tx: round(Math.max(0, netStats.tx_sec)),
			},
			fs: {
				r: round(Math.max(0, fsStats.rIO_sec ?? 0)),
				w: round(Math.max(0, fsStats.wIO_sec ?? 0)),
			},
		};
		ev.emit('serverStats', stats);
		log.unshift(stats);
		if (log.length > 200) log.pop();
	}

	tick();

	setInterval(tick, interval);
}

// CPU STAT
function cpuUsage(): Promise<number> {
	return new Promise((res, rej) => {
		try {
			osUtils.cpuUsage((cpuUsage) => {
				res(cpuUsage);
			});
		} catch (error) {
			console.error('Error getting cpu usage:', error);
			res(0);
		}
	});
}

// MEMORY STAT
async function mem() {
	try {
		const data = await si.mem();
		return data;
	} catch (error) {
		console.error('Error getting memory stats:', error);
		return { used: 0, buffers: 0, cached: 0, active: 0 };
	}
}

// NETWORK STAT
async function net() {
	try {
		const iface = await si.networkInterfaceDefault();
		const data = await si.networkStats(iface);
		return data[0];
	} catch (error) {
		console.error('Error getting network stats:', error);
		return { rx_sec: 0, tx_sec: 0 };
	}
}

// FS STAT
async function fs() {
	try {
		const data = await si.disksIO().catch(() => ({ rIO_sec: 0, wIO_sec: 0 }));
		return data || { rIO_sec: 0, wIO_sec: 0 };
	} catch (error) {
		console.error('Error getting filesystem stats:', error);
		return { rIO_sec: 0, wIO_sec: 0 };
	}
}
