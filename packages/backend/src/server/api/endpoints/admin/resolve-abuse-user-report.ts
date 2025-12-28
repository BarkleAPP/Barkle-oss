import define from '../../define.js';
import { AbuseUserReports, Users } from '@/models/index.js';

export const meta = {
	tags: ['admin'],

	requireCredential: true,
	requireModerator: true,
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		reportId: { type: 'string', format: 'barkle:id' },
		forward: { type: 'boolean', default: false },
	},
	required: ['reportId'],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const report = await AbuseUserReports.findOneByOrFail({ id: ps.reportId });

	if (report == null) {
		throw new Error('report not found');
	}

	await AbuseUserReports.update(report.id, {
		resolved: true,
		assigneeId: me.id,
		forwarded: ps.forward && report.targetUserHost != null,
	});
});
