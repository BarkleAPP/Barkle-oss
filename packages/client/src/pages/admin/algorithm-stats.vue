<template>
<div>
	<MkSpacer :content-max="700" :margin-min="16" :margin-max="32">
		<FormSuspense :p="init">
			<div class="_formRoot">
				<FormSection>
					<template #label>Algorithm Performance</template>
					
					<div class="stats-grid">
						<div class="stat-card">
							<div class="stat-value">{{ stats.cache?.overall?.hitRate ? (stats.cache.overall.hitRate * 100).toFixed(1) : '0' }}%</div>
							<div class="stat-label">Cache Hit Rate</div>
						</div>
						
						<div class="stat-card">
							<div class="stat-value">{{ stats.cache?.overall?.totalRequests || 0 }}</div>
							<div class="stat-label">Total Requests</div>
						</div>
						
						<div class="stat-card">
							<div class="stat-value">{{ formatBytes(stats.cache?.overall?.memoryUsage || 0) }}</div>
							<div class="stat-label">Memory Usage</div>
						</div>
						
						<div class="stat-card">
							<div class="stat-value">{{ stats.mmr?.totalProcessed || 0 }}</div>
							<div class="stat-label">MMR Processed</div>
						</div>
					</div>
				</FormSection>

				<FormSection>
					<template #label>Cache Statistics</template>
					
					<div v-if="stats.cache?.levels" class="cache-levels">
						<div v-for="level in stats.cache.levels" :key="level.level" class="cache-level">
							<h4>{{ level.level }} Cache</h4>
							<div class="level-stats">
								<div class="level-stat">
									<span class="label">Hit Rate:</span>
									<span class="value">{{ (level.hitRate * 100).toFixed(1) }}%</span>
								</div>
								<div class="level-stat">
									<span class="label">Entries:</span>
									<span class="value">{{ level.entryCount.toLocaleString() }}</span>
								</div>
								<div class="level-stat">
									<span class="label">Memory:</span>
									<span class="value">{{ formatBytes(level.memoryUsage) }}</span>
								</div>
								<div class="level-stat">
									<span class="label">Avg Access Time:</span>
									<span class="value">{{ level.averageAccessTime.toFixed(2) }}ms</span>
								</div>
							</div>
						</div>
					</div>
				</FormSection>

				<FormSection>
					<template #label>MMR Algorithm</template>
					
					<div v-if="stats.mmr" class="mmr-stats">
						<div class="mmr-stat">
							<span class="label">Total Processed:</span>
							<span class="value">{{ stats.mmr.totalProcessed?.toLocaleString() || 0 }}</span>
						</div>
						<div class="mmr-stat">
							<span class="label">Average Processing Time:</span>
							<span class="value">{{ stats.mmr.averageProcessingTime?.toFixed(2) || 0 }}ms</span>
						</div>
						<div class="mmr-stat">
							<span class="label">Cache Hit Rate:</span>
							<span class="value">{{ stats.mmr.cacheHitRate ? (stats.mmr.cacheHitRate * 100).toFixed(1) : 0 }}%</span>
						</div>
						<div class="mmr-stat">
							<span class="label">Cache Size:</span>
							<span class="value">{{ stats.mmr.cacheSize?.toLocaleString() || 0 }} entries</span>
						</div>
					</div>
				</FormSection>

				<FormSection>
					<template #label>Quality Assessment</template>
					
					<div v-if="stats.quality" class="quality-stats">
						<div class="quality-stat">
							<span class="label">Total Assessments:</span>
							<span class="value">{{ stats.quality.totalAssessments?.toLocaleString() || 0 }}</span>
						</div>
						<div class="quality-stat">
							<span class="label">Cache Hit Rate:</span>
							<span class="value">{{ stats.quality.cacheHitRate ? (stats.quality.cacheHitRate * 100).toFixed(1) : 0 }}%</span>
						</div>
						<div class="quality-stat">
							<span class="label">Average Processing Time:</span>
							<span class="value">{{ stats.quality.averageProcessingTime?.toFixed(2) || 0 }}ms</span>
						</div>
						
						<div v-if="stats.quality.qualityDistribution" class="quality-distribution">
							<h5>Quality Distribution</h5>
							<div class="distribution-bars">
								<div class="distribution-bar">
									<span class="bar-label">High Quality</span>
									<div class="bar">
										<div class="bar-fill" :style="{ width: (stats.quality.qualityDistribution.high * 100) + '%' }"></div>
									</div>
									<span class="bar-value">{{ (stats.quality.qualityDistribution.high * 100).toFixed(1) }}%</span>
								</div>
								<div class="distribution-bar">
									<span class="bar-label">Medium Quality</span>
									<div class="bar">
										<div class="bar-fill" :style="{ width: (stats.quality.qualityDistribution.medium * 100) + '%' }"></div>
									</div>
									<span class="bar-value">{{ (stats.quality.qualityDistribution.medium * 100).toFixed(1) }}%</span>
								</div>
								<div class="distribution-bar">
									<span class="bar-label">Low Quality</span>
									<div class="bar">
										<div class="bar-fill" :style="{ width: (stats.quality.qualityDistribution.low * 100) + '%' }"></div>
									</div>
									<span class="bar-value">{{ (stats.quality.qualityDistribution.low * 100).toFixed(1) }}%</span>
								</div>
							</div>
						</div>
					</div>
				</FormSection>

				<FormSection>
					<template #label>Pre-computation</template>
					
					<div v-if="stats.precomputation" class="precomputation-stats">
						<div class="precomp-jobs" v-if="stats.precomputation.jobs">
							<h5>Job Statistics</h5>
							<div class="job-stats">
								<div class="job-stat">
									<span class="label">Total Jobs:</span>
									<span class="value">{{ stats.precomputation.jobs.total?.toLocaleString() || 0 }}</span>
								</div>
								<div class="job-stat">
									<span class="label">Pending:</span>
									<span class="value">{{ stats.precomputation.jobs.pending?.toLocaleString() || 0 }}</span>
								</div>
								<div class="job-stat">
									<span class="label">Running:</span>
									<span class="value">{{ stats.precomputation.jobs.running?.toLocaleString() || 0 }}</span>
								</div>
								<div class="job-stat">
									<span class="label">Completed:</span>
									<span class="value">{{ stats.precomputation.jobs.completed?.toLocaleString() || 0 }}</span>
								</div>
								<div class="job-stat">
									<span class="label">Failed:</span>
									<span class="value">{{ stats.precomputation.jobs.failed?.toLocaleString() || 0 }}</span>
								</div>
							</div>
						</div>
						
						<div class="precomp-performance" v-if="stats.precomputation.performance">
							<h5>Performance Metrics</h5>
							<div class="perf-stats">
								<div class="perf-stat">
									<span class="label">Average Job Duration:</span>
									<span class="value">{{ stats.precomputation.performance.averageJobDuration?.toFixed(2) || 0 }}ms</span>
								</div>
								<div class="perf-stat">
									<span class="label">Success Rate:</span>
									<span class="value">{{ stats.precomputation.performance.successRate ? (stats.precomputation.performance.successRate * 100).toFixed(1) : 0 }}%</span>
								</div>
								<div class="perf-stat">
									<span class="label">Cache Hit Rate:</span>
									<span class="value">{{ stats.precomputation.performance.cacheHitRate ? (stats.precomputation.performance.cacheHitRate * 100).toFixed(1) : 0 }}%</span>
								</div>
							</div>
						</div>
					</div>
				</FormSection>

				<FormSection>
					<template #label>Actions</template>
					
					<div class="actions">
						<MkButton @click="refreshStats" :loading="loading">
							<i class="ph-arrow-clockwise-bold ph-lg"></i>
							Refresh Stats
						</MkButton>
					</div>
				</FormSection>
			</div>
		</FormSuspense>
	</MkSpacer>
</div>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import FormSection from '@/components/form/section.vue';
import FormSuspense from '@/components/form/suspense.vue';
import MkButton from '@/components/MkButton.vue';
import * as os from '@/os';
import { i18n } from '@/i18n';
import { definePageMetadata } from '@/scripts/page-metadata';

const stats = ref<any>({});
const loading = ref(false);

const formatBytes = (bytes: number): string => {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const refreshStats = async () => {
	loading.value = true;
	try {
		const result = await os.api('algorithm/stats');
		stats.value = result;
	} catch (error) {
		console.error('Failed to fetch algorithm stats:', error);
		os.alert({
			type: 'error',
			text: 'Failed to fetch algorithm statistics'
		});
	} finally {
		loading.value = false;
	}
};

const init = async () => {
	await refreshStats();
};

onMounted(() => {
	// Auto-refresh every 30 seconds
	const interval = setInterval(refreshStats, 30000);
	
	// Cleanup on unmount
	return () => clearInterval(interval);
});

definePageMetadata({
	title: 'Algorithm Statistics',
	icon: 'ph-brain-bold ph-lg',
});
</script>

<style lang="scss" scoped>
.stats-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
	gap: 16px;
	margin-bottom: 16px;
}

.stat-card {
	background: var(--panel);
	border-radius: 8px;
	padding: 16px;
	text-align: center;
	border: 1px solid var(--divider);
}

.stat-value {
	font-size: 2em;
	font-weight: bold;
	color: var(--accent);
	margin-bottom: 4px;
}

.stat-label {
	font-size: 0.9em;
	color: var(--fgTransparentWeak);
}

.cache-levels {
	display: grid;
	gap: 16px;
}

.cache-level {
	background: var(--panel);
	border-radius: 8px;
	padding: 16px;
	border: 1px solid var(--divider);
	
	h4 {
		margin: 0 0 12px 0;
		color: var(--accent);
	}
}

.level-stats {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
	gap: 8px;
}

.level-stat, .mmr-stat, .quality-stat, .job-stat, .perf-stat {
	display: flex;
	justify-content: space-between;
	padding: 4px 0;
	border-bottom: 1px solid var(--divider);
	
	.label {
		color: var(--fg);
	}
	
	.value {
		font-weight: bold;
		color: var(--accent);
	}
}

.mmr-stats, .quality-stats, .precomputation-stats {
	background: var(--panel);
	border-radius: 8px;
	padding: 16px;
	border: 1px solid var(--divider);
}

.quality-distribution {
	margin-top: 16px;
	
	h5 {
		margin: 0 0 12px 0;
		color: var(--accent);
	}
}

.distribution-bars {
	display: grid;
	gap: 8px;
}

.distribution-bar {
	display: grid;
	grid-template-columns: 100px 1fr 60px;
	align-items: center;
	gap: 12px;
}

.bar-label {
	font-size: 0.9em;
	color: var(--fg);
}

.bar {
	height: 20px;
	background: var(--bg);
	border-radius: 10px;
	overflow: hidden;
	border: 1px solid var(--divider);
}

.bar-fill {
	height: 100%;
	background: linear-gradient(90deg, var(--accent), var(--accentLighten));
	transition: width 0.3s ease;
}

.bar-value {
	font-size: 0.9em;
	font-weight: bold;
	color: var(--accent);
	text-align: right;
}

.precomp-jobs, .precomp-performance {
	margin-bottom: 16px;
	
	&:last-child {
		margin-bottom: 0;
	}
	
	h5 {
		margin: 0 0 12px 0;
		color: var(--accent);
	}
}

.job-stats, .perf-stats {
	display: grid;
	gap: 4px;
}

.actions {
	display: flex;
	gap: 12px;
	flex-wrap: wrap;
}
</style>