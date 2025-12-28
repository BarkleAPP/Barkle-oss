import define from '../../define.js';
import { abTestingService, ExperimentResult } from '@/services/algorithm/ab-testing-service.js';
import Logger from '@/services/logger.js';

const logger = new Logger('algorithm-ab-tests');

export const meta = {
	tags: ['algorithm'],
	requireCredential: true,
	requireAdmin: true,
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		action: {
			type: 'string',
			enum: ['list', 'results', 'create', 'update_status'],
			default: 'list'
		},
		experimentId: {
			type: 'string'
		},
		status: {
			type: 'string',
			enum: ['draft', 'active', 'paused', 'completed']
		},
		experimentConfig: {
			type: 'object'
		}
	},
	required: []
} as const;

export default define(meta, paramDef, async (ps, user) => {
	try {
		const action = ps.action || 'list';

		switch (action) {
			case 'list':
				// Get all experiments
				const experiments = await abTestingService.getActiveExperiments();
				const stats = await abTestingService.getStats();

				logger.info(`A/B test list requested by admin user ${user.id}`);

				return {
					experiments: experiments.map(exp => ({
						id: exp.id,
						name: exp.name,
						description: exp.description,
						status: exp.status,
						startDate: exp.startDate,
						endDate: exp.endDate,
						trafficAllocation: exp.trafficAllocation,
						variants: Object.keys(exp.variants),
						primaryMetric: exp.primaryMetric,
						secondaryMetrics: exp.secondaryMetrics
					})),
					stats
				};

			case 'results':
				if (!ps.experimentId) {
					throw new Error('experimentId required for results action');
				}

				const results: ExperimentResult[] = await abTestingService.getExperimentResults(ps.experimentId);

				logger.info(`A/B test results requested for experiment ${ps.experimentId} by admin user ${user.id}`);

				return {
					experimentId: ps.experimentId,
					results: results.map((result: ExperimentResult) => ({
						variantId: result.variantId,
						userCount: result.userCount,
						metrics: result.metrics,
						status: result.status,
						startDate: result.startDate,
						endDate: result.endDate
					})),
					stats: await abTestingService.getStats()
				};

			case 'create':
				if (!ps.experimentConfig) {
					throw new Error('experimentConfig required for create action');
				}

				const experimentId = await abTestingService.createExperiment({
					...ps.experimentConfig,
					status: 'draft' as const,
					startDate: new Date(),
					minimumSampleSize: 100,
					confidenceLevel: 0.95
				});

				logger.info(`A/B test experiment created: ${experimentId} by admin user ${user.id}`);

				return {
					success: true,
					experimentId,
					message: 'Experiment created successfully',
					stats: await abTestingService.getStats()
				};

			case 'update_status':
				if (!ps.experimentId || !ps.status) {
					throw new Error('experimentId and status required for update_status action');
				}

				const success = await abTestingService.updateExperimentStatus(ps.experimentId, ps.status as any);

				logger.info(`A/B test ${ps.experimentId} status updated to ${ps.status} by admin user ${user.id}`);

				return {
					success,
					experimentId: ps.experimentId,
					newStatus: ps.status,
					stats: await abTestingService.getStats()
				};

			default:
				throw new Error(`Unknown action: ${action}`);
		}

	} catch (error) {
		logger.error('Error in A/B test management:', error as Error);

		return {
			experiments: [],
			stats: {
				totalExperiments: 0,
				activeExperiments: 0,
				totalUsers: 0,
				experimentsWithResults: 0
			},
			error: (error as Error).message
		};
	}
});