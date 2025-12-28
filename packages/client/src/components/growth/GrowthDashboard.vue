<template>
	<div class="growth-dashboard">
		<div class="dashboard-header">
			<h2>{{ i18n.ts.growthDashboard }}</h2>
			<p>{{ i18n.ts.trackYourGrowthMomentum }}</p>
		</div>

		<div class="momentum-section">
			<div class="momentum-card">
				<div class="momentum-score">
					<div class="score-circle" :class="momentumLevel">
						<span class="score-number">{{ momentum?.momentumScore || 0 }}</span>
						<span class="score-label">{{ i18n.ts.momentumScore }}</span>
					</div>
				</div>
				<div class="momentum-details">
					<div class="metric">
						<i class="fas fa-users"></i>
						<span class="metric-value">{{ momentum?.followersGained24h || 0 }}</span>
						<span class="metric-label">{{ i18n.ts.followersToday }}</span>
					</div>
					<div class="metric">
						<i class="fas fa-share"></i>
						<span class="metric-value">{{ momentum?.invitationsAccepted24h || 0 }}</span>
						<span class="metric-label">{{ i18n.ts.invitationsAccepted }}</span>
					</div>
					<div class="metric">
						<i class="fas fa-chart-line"></i>
						<span class="metric-value">{{ (momentum?.networkGrowthRate || 0).toFixed(1) }}%</span>
						<span class="metric-label">{{ i18n.ts.growthRate }}</span>
					</div>
					<div class="metric">
						<i class="fas fa-rocket"></i>
						<span class="metric-value">{{ (momentum?.viralCoefficient || 0).toFixed(2) }}</span>
						<span class="metric-label">{{ i18n.ts.viralCoefficient }}</span>
					</div>
				</div>
			</div>
		</div>

		<div class="charts-section">
			<div class="chart-container">
				<h3>{{ i18n.ts.networkGrowthTrend }}</h3>
				<canvas ref="growthChart" width="400" height="200"></canvas>
			</div>
			<div class="chart-container">
				<h3>{{ i18n.ts.viralCoefficientHistory }}</h3>
				<canvas ref="viralChart" width="400" height="200"></canvas>
			</div>
		</div>

		<div class="viral-moments-section">
			<h3>{{ i18n.ts.recentViralMoments }}</h3>
			<div class="viral-moments-grid">
				<div 
					v-for="moment in viralMoments" 
					:key="moment.id"
					class="viral-moment-card"
					:class="moment.type"
				>
					<div class="moment-icon">
						<i :class="getMomentIcon(moment.type)"></i>
					</div>
					<div class="moment-content">
						<h4>{{ getMomentTitle(moment.type) }}</h4>
						<p>{{ getMomentDescription(moment) }}</p>
						<span class="moment-time">{{ formatTime(moment.timestamp) }}</span>
					</div>
					<div class="moment-score">
						{{ moment.amplificationScore }}
					</div>
				</div>
			</div>
		</div>

		<div class="growth-actions">
			<h3>{{ i18n.ts.boostYourGrowth }}</h3>
			<div class="action-buttons">
				<MkButton @click="openInviteFriends" primary>
					<i class="fas fa-user-plus"></i>
					{{ i18n.ts.inviteFriends }}
				</MkButton>
				<MkButton @click="openContactImport">
					<i class="fas fa-address-book"></i>
					{{ i18n.ts.findContacts }}
				</MkButton>
				<MkButton @click="openTrendingContent">
					<i class="fas fa-fire"></i>
					{{ i18n.ts.viewTrending }}
				</MkButton>
				<MkButton @click="refreshAnalytics">
					<i class="fas fa-sync-alt"></i>
					{{ i18n.ts.refresh }}
				</MkButton>
			</div>
		</div>

		<div class="community-events">
			<h3>{{ i18n.ts.communityEvents }}</h3>
			<div class="events-list">
				<div 
					v-for="event in communityEvents" 
					:key="event.id"
					class="event-card"
				>
					<div class="event-icon">
						<i :class="event.icon"></i>
					</div>
					<div class="event-content">
						<h4>{{ event.title }}</h4>
						<p>{{ event.description }}</p>
						<div class="event-progress" v-if="event.progress">
							<div class="progress-bar">
								<div 
									class="progress-fill" 
									:style="{ width: `${event.progress.percentage}%` }"
								></div>
							</div>
							<span class="progress-text">
								{{ event.progress.current }} / {{ event.progress.target }}
							</span>
						</div>
					</div>
					<MkButton 
						v-if="event.actionable" 
						@click="participateInEvent(event)"
						small
					>
						{{ i18n.ts.participate }}
					</MkButton>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import * as os from '@/os';
import { i18n } from '@/i18n';
import { Chart } from 'chart.js/auto';

interface GrowthMomentum {
	userId: string;
	followersGained24h: number;
	followingGained24h: number;
	invitationsAccepted24h: number;
	networkGrowthRate: number;
	viralCoefficient: number;
	momentumScore: number;
}

interface ViralMoment {
	id: string;
	type: 'rapid_growth' | 'milestone_reached' | 'viral_content' | 'network_effect';
	timestamp: Date;
	amplificationScore: number;
	data: Record<string, any>;
}

interface CommunityEvent {
	id: string;
	title: string;
	description: string;
	icon: string;
	actionable: boolean;
	progress?: {
		current: number;
		target: number;
		percentage: number;
	};
}

const momentum = ref<GrowthMomentum | null>(null);
const analytics = ref<any>(null);
const viralMoments = ref<ViralMoment[]>([]);
const communityEvents = ref<CommunityEvent[]>([]);
const growthChart = ref<HTMLCanvasElement>();
const viralChart = ref<HTMLCanvasElement>();

const momentumLevel = computed(() => {
	if (!momentum.value) return 'low';
	const score = momentum.value.momentumScore;
	if (score >= 80) return 'high';
	if (score >= 50) return 'medium';
	return 'low';
});

onMounted(async () => {
	await loadGrowthData();
	await nextTick();
	initializeCharts();
});

async function loadGrowthData() {
	try {
		// Load momentum data
		const momentumData = await os.api('viral-growth/momentum');
		momentum.value = momentumData;

		// Load full analytics
		const analyticsData = await os.api('viral-growth/analytics');
		analytics.value = analyticsData;

		// Generate mock viral moments (in real implementation, this would come from API)
		generateMockViralMoments();

		// Generate community events
		generateCommunityEvents();

	} catch (error) {
		console.error('Failed to load growth data:', error);
		os.alert(i18n.ts.failedToLoadGrowthData);
	}
}

function generateMockViralMoments() {
	const mockMoments: ViralMoment[] = [];
	
	if (momentum.value?.followersGained24h && momentum.value.followersGained24h >= 5) {
		mockMoments.push({
			id: '1',
			type: 'rapid_growth',
			timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
			amplificationScore: momentum.value.followersGained24h * 2,
			data: { followersGained: momentum.value.followersGained24h },
		});
	}

	if (momentum.value?.viralCoefficient && momentum.value.viralCoefficient >= 1.5) {
		mockMoments.push({
			id: '2',
			type: 'milestone_reached',
			timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
			amplificationScore: momentum.value.viralCoefficient * 10,
			data: { viralCoefficient: momentum.value.viralCoefficient },
		});
	}

	viralMoments.value = mockMoments;
}

function generateCommunityEvents() {
	const events: CommunityEvent[] = [
		{
			id: 'growth_challenge',
			title: i18n.ts.weeklyGrowthChallenge,
			description: i18n.ts.inviteFriendsThisWeek,
			icon: 'fas fa-trophy',
			actionable: true,
			progress: {
				current: momentum.value?.invitationsAccepted24h || 0,
				target: 5,
				percentage: Math.min(((momentum.value?.invitationsAccepted24h || 0) / 5) * 100, 100),
			},
		},
		{
			id: 'content_creator',
			title: i18n.ts.contentCreatorSpotlight,
			description: i18n.ts.shareYourBestContent,
			icon: 'fas fa-star',
			actionable: true,
		},
		{
			id: 'community_milestone',
			title: i18n.ts.communityMilestone,
			description: i18n.ts.helpUsReach10kUsers,
			icon: 'fas fa-users',
			actionable: false,
			progress: {
				current: 8500, // Mock data
				target: 10000,
				percentage: 85,
			},
		},
	];

	communityEvents.value = events;
}

function initializeCharts() {
	if (!analytics.value) return;

	// Network Growth Trend Chart
	if (growthChart.value) {
		new Chart(growthChart.value, {
			type: 'line',
			data: {
				labels: Array.from({ length: 7 }, (_, i) => {
					const date = new Date();
					date.setDate(date.getDate() - (6 - i));
					return date.toLocaleDateString();
				}),
				datasets: [{
					label: i18n.ts.followersGained,
					data: analytics.value.networkGrowthTrend || [0, 1, 2, 1, 3, 2, 4],
					borderColor: 'rgb(75, 192, 192)',
					backgroundColor: 'rgba(75, 192, 192, 0.2)',
					tension: 0.4,
				}],
			},
			options: {
				responsive: true,
				plugins: {
					legend: {
						display: false,
					},
				},
				scales: {
					y: {
						beginAtZero: true,
					},
				},
			},
		});
	}

	// Viral Coefficient History Chart
	if (viralChart.value) {
		new Chart(viralChart.value, {
			type: 'bar',
			data: {
				labels: Array.from({ length: 7 }, (_, i) => {
					const date = new Date();
					date.setDate(date.getDate() - (6 - i));
					return date.toLocaleDateString();
				}),
				datasets: [{
					label: i18n.ts.viralCoefficient,
					data: analytics.value.viralCoefficientHistory || [0.5, 0.8, 1.2, 0.9, 1.5, 1.1, 1.8],
					backgroundColor: 'rgba(255, 99, 132, 0.6)',
					borderColor: 'rgba(255, 99, 132, 1)',
					borderWidth: 1,
				}],
			},
			options: {
				responsive: true,
				plugins: {
					legend: {
						display: false,
					},
				},
				scales: {
					y: {
						beginAtZero: true,
						max: 3,
					},
				},
			},
		});
	}
}

function getMomentIcon(type: string): string {
	const icons = {
		rapid_growth: 'fas fa-chart-line',
		milestone_reached: 'fas fa-trophy',
		viral_content: 'fas fa-fire',
		network_effect: 'fas fa-network-wired',
	};
	return icons[type] || 'fas fa-star';
}

function getMomentTitle(type: string): string {
	const titles = {
		rapid_growth: i18n.ts.rapidGrowth,
		milestone_reached: i18n.ts.milestoneReached,
		viral_content: i18n.ts.viralContent,
		network_effect: i18n.ts.networkEffect,
	};
	return titles[type] || i18n.ts.viralMoment;
}

function getMomentDescription(moment: ViralMoment): string {
	switch (moment.type) {
		case 'rapid_growth':
			return i18n.t('gainedXFollowers', { count: moment.data.followersGained });
		case 'milestone_reached':
			return i18n.t('viralCoefficientReached', { coefficient: moment.data.viralCoefficient });
		case 'viral_content':
			return i18n.t('contentWentViral', { engagement: moment.data.engagementCount });
		case 'network_effect':
			return i18n.t('networkEffectTriggered', { connections: moment.data.connections });
		default:
			return i18n.ts.somethingExcitingHappened;
	}
}

function formatTime(timestamp: Date): string {
	const now = new Date();
	const diff = now.getTime() - timestamp.getTime();
	const hours = Math.floor(diff / (1000 * 60 * 60));
	
	if (hours < 1) {
		const minutes = Math.floor(diff / (1000 * 60));
		return i18n.t('minutesAgo', { minutes });
	} else if (hours < 24) {
		return i18n.t('hoursAgo', { hours });
	} else {
		const days = Math.floor(hours / 24);
		return i18n.t('daysAgo', { days });
	}
}

async function openInviteFriends() {
	os.popup(import('@/components/growth/InviteFriends.vue'), {}, {}, 'closed');
}

async function openContactImport() {
	os.popup(import('@/components/growth/ContactImport.vue'), {}, {}, 'closed');
}

async function openTrendingContent() {
	// Navigate to trending content page
	os.pageWindow('/trending');
}

async function refreshAnalytics() {
	await loadGrowthData();
	os.success(i18n.ts.analyticsRefreshed);
}

async function participateInEvent(event: CommunityEvent) {
	switch (event.id) {
		case 'growth_challenge':
			await openInviteFriends();
			break;
		case 'content_creator':
			// Open post composer
			os.post();
			break;
		default:
			os.alert(i18n.ts.eventNotImplemented);
	}
}
</script>

<style lang="scss" scoped>
.growth-dashboard {
	padding: 20px;
	max-width: 1200px;
	margin: 0 auto;
}

.dashboard-header {
	text-align: center;
	margin-bottom: 30px;

	h2 {
		margin: 0 0 10px 0;
		color: var(--fg);
	}

	p {
		margin: 0;
		color: var(--fgTransparentWeak);
	}
}

.momentum-section {
	margin-bottom: 30px;
}

.momentum-card {
	display: flex;
	align-items: center;
	gap: 30px;
	padding: 25px;
	background: var(--panel);
	border-radius: 12px;
	border: 1px solid var(--divider);

	@media (max-width: 768px) {
		flex-direction: column;
		gap: 20px;
	}
}

.momentum-score {
	flex-shrink: 0;
}

.score-circle {
	width: 120px;
	height: 120px;
	border-radius: 50%;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	position: relative;
	
	&.low {
		background: linear-gradient(135deg, #ff6b6b, #ffa500);
	}
	
	&.medium {
		background: linear-gradient(135deg, #ffa500, #32cd32);
	}
	
	&.high {
		background: linear-gradient(135deg, #32cd32, #00bfff);
	}

	.score-number {
		font-size: 28px;
		font-weight: bold;
		color: white;
		line-height: 1;
	}

	.score-label {
		font-size: 12px;
		color: rgba(255, 255, 255, 0.9);
		margin-top: 4px;
	}
}

.momentum-details {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
	gap: 20px;
	flex: 1;
}

.metric {
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;

	i {
		font-size: 24px;
		color: var(--accent);
		margin-bottom: 8px;
	}

	.metric-value {
		font-size: 20px;
		font-weight: bold;
		color: var(--fg);
		margin-bottom: 4px;
	}

	.metric-label {
		font-size: 12px;
		color: var(--fgTransparentWeak);
	}
}

.charts-section {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 20px;
	margin-bottom: 30px;

	@media (max-width: 768px) {
		grid-template-columns: 1fr;
	}
}

.chart-container {
	padding: 20px;
	background: var(--panel);
	border-radius: 12px;
	border: 1px solid var(--divider);

	h3 {
		margin: 0 0 15px 0;
		font-size: 16px;
		color: var(--fg);
	}

	canvas {
		max-width: 100%;
		height: auto;
	}
}

.viral-moments-section {
	margin-bottom: 30px;

	h3 {
		margin: 0 0 15px 0;
		color: var(--fg);
	}
}

.viral-moments-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
	gap: 15px;
}

.viral-moment-card {
	display: flex;
	align-items: center;
	gap: 15px;
	padding: 15px;
	background: var(--panel);
	border-radius: 8px;
	border: 1px solid var(--divider);
	position: relative;

	&.rapid_growth {
		border-left: 4px solid #32cd32;
	}

	&.milestone_reached {
		border-left: 4px solid #ffd700;
	}

	&.viral_content {
		border-left: 4px solid #ff6b6b;
	}

	&.network_effect {
		border-left: 4px solid #00bfff;
	}

	.moment-icon {
		flex-shrink: 0;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: var(--accent);
		display: flex;
		align-items: center;
		justify-content: center;

		i {
			color: white;
			font-size: 18px;
		}
	}

	.moment-content {
		flex: 1;

		h4 {
			margin: 0 0 5px 0;
			font-size: 14px;
			color: var(--fg);
		}

		p {
			margin: 0 0 5px 0;
			font-size: 12px;
			color: var(--fgTransparentWeak);
		}

		.moment-time {
			font-size: 11px;
			color: var(--fgTransparentWeak);
		}
	}

	.moment-score {
		flex-shrink: 0;
		font-size: 18px;
		font-weight: bold;
		color: var(--accent);
	}
}

.growth-actions {
	margin-bottom: 30px;

	h3 {
		margin: 0 0 15px 0;
		color: var(--fg);
	}
}

.action-buttons {
	display: flex;
	gap: 10px;
	flex-wrap: wrap;

	button {
		i {
			margin-right: 8px;
		}
	}
}

.community-events {
	h3 {
		margin: 0 0 15px 0;
		color: var(--fg);
	}
}

.events-list {
	display: flex;
	flex-direction: column;
	gap: 15px;
}

.event-card {
	display: flex;
	align-items: center;
	gap: 15px;
	padding: 20px;
	background: var(--panel);
	border-radius: 12px;
	border: 1px solid var(--divider);

	.event-icon {
		flex-shrink: 0;
		width: 50px;
		height: 50px;
		border-radius: 50%;
		background: var(--accent);
		display: flex;
		align-items: center;
		justify-content: center;

		i {
			color: white;
			font-size: 20px;
		}
	}

	.event-content {
		flex: 1;

		h4 {
			margin: 0 0 8px 0;
			color: var(--fg);
		}

		p {
			margin: 0 0 10px 0;
			color: var(--fgTransparentWeak);
			font-size: 14px;
		}
	}

	.event-progress {
		display: flex;
		align-items: center;
		gap: 10px;

		.progress-bar {
			flex: 1;
			height: 8px;
			background: var(--bg);
			border-radius: 4px;
			overflow: hidden;

			.progress-fill {
				height: 100%;
				background: var(--accent);
				transition: width 0.3s ease;
			}
		}

		.progress-text {
			font-size: 12px;
			color: var(--fgTransparentWeak);
			white-space: nowrap;
		}
	}
}
</style>