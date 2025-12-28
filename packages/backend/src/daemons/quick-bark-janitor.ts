import { QuickBarks } from '@/models/index.js';
import { LessThan } from 'typeorm';
import Logger from '@/services/logger.js';

const log = new Logger('quick-bark-janitor');
const interval = 60 * 60 * 1000; // Run every hour

export default function () {
	async function tick() {
		try {
			await QuickBarks.delete({
				expiresAt: LessThan(new Date()),
			});
		} catch (e) {
			log.error(e as Error);
		}
	}

	tick();

	setInterval(tick, interval);
}
