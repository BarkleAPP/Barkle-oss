<template>
	<MkStickyContainer>
		<template #header>
			<MkPageHeader :actions="headerActions" :tabs="headerTabs" />
		</template>
		<MkSpacer :content-max="800">
			<div class="social-proof-test">
				<div class="section">
					<h2>{{ i18n.ts.socialProofTesting }}</h2>
					<p>{{ i18n.ts.socialProofTestingDescription }}</p>
				</div>

				<div class="section">
					<h3>{{ i18n.ts.activityIndicators }}</h3>
					<div class="indicator-examples">
						<SocialProofIndicator 
							type="activity"
							:data="{ activeCount: 3 }"
							:auto-hide="false"
						/>
						<SocialProofIndicator 
							type="activity"
							:data="{ activeCount: 8 }"
							:auto-hide="false"
						/>
					</div>
				</div>

				<div class="section">
					<h3>{{ i18n.ts.engagementIndicators }}</h3>
					<div class="indicator-examples">
						<SocialProofIndicator 
							type="engagement"
							:data="{ engagementCount: 5, timeWindow: 3600 }"
							:auto-hide="false"
						/>
						<SocialProofIndicator 
							type="engagement"
							:data="{ engagementCount: 25, timeWindow: 1800 }"
							:auto-hide="false"
						/>
					</div>
				</div>

				<div class="section">
					<h3>{{ i18n.ts.socialValidation }}</h3>
					<div class="indicator-examples">
						<SocialProofIndicator 
							type="social"
							:data="{ socialUsers: mockUsers.slice(0, 1) }"
							:auto-hide="false"
						/>
						<SocialProofIndicator 
							type="social"
							:data="{ socialUsers: mockUsers.slice(0, 3) }"
							:auto-hide="false"
						/>
					</div>
				</div>

				<div class="section">
					<h3>{{ i18n.ts.trendingContent }}</h3>
					<div class="indicator-examples">
						<SocialProofIndicator 
							type="trending"
							:data="{ isTrending: true }"
							:auto-hide="false"
						/>
					</div>
				</div>

				<div class="section">
					<h3>{{ i18n.ts.liveDemo }}</h3>
					<div class="demo-controls">
						<MkButton @click="loadTrendingNotes" :loading="loadingTrending">
							{{ i18n.ts.loadTrendingNotes }}
						</MkButton>
						<MkButton @click="loadActivityData" :loading="loadingActivity">
							{{ i18n.ts.loadActivityData }}
						</MkButton>
					</div>
					
					<div v-if="trendingNotes.length > 0" class="trending-notes">
						<h4>{{ i18n.ts.currentTrendingNotes }}</h4>
						<div class="note-list">
							<MkNote 
								v-for="note in trendingNotes" 
								:key="note.id" 
								:note="note"
								class="note"
							/>
						</div>
					</div>

					<div v-if="activityData" class="activity-data">
						<h4>{{ i18n.ts.currentActivity }}</h4>
						<div class="activity-stats">
							<div class="stat">
								<span class="label">{{ i18n.ts.activeUsers }}</span>
								<span class="value">{{ activityData.activeUsers }}</span>
							</div>
							<div class="stat">
								<span class="label">{{ i18n.ts.recentNotes }}</span>
								<span class="value">{{ activityData.recentNotes }}</span>
							</div>
							<div class="stat">
								<span class="label">{{ i18n.ts.recentEngagement }}</span>
								<span class="value">{{ activityData.recentEngagement }}</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</MkSpacer>
	</MkStickyContainer>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { i18n } from '@/i18n';
import { definePageMetadata } from '@/scripts/page-metadata';
import SocialProofIndicator from '@/components/growth/SocialProofIndicator.vue';
import MkNote from '@/components/MkNote.vue';
import * as os from '@/os';

const loadingTrending = ref(false);
const loadingActivity = ref(false);
const trendingNotes = ref([]);
const activityData = ref(null);

// Mock users for social proof examples
const mockUsers = ref([
	{
		id: '1',
		username: 'alice',
		name: 'Alice',
		avatarUrl: null,
	},
	{
		id: '2',
		username: 'bob',
		name: 'Bob',
		avatarUrl: null,
	},
	{
		id: '3',
		username: 'charlie',
		name: 'Charlie',
		avatarUrl: null,
	},
]);

async function loadTrendingNotes() {
	loadingTrending.value = true;
	try {
		const notes = await os.api('notes/trending', {
			limit: 5,
			timeframe: '24h',
		});
		trendingNotes.value = notes;
	} catch (error) {
		os.alert(i18n.ts.failedToLoadTrending);
	} finally {
		loadingTrending.value = false;
	}
}

async function loadActivityData() {
	loadingActivity.value = true;
	try {
		const data = await os.api('activity/indicators');
		activityData.value = data;
	} catch (error) {
		os.alert(i18n.ts.failedToLoadActivity);
	} finally {
		loadingActivity.value = false;
	}
}

const headerActions = [];
const headerTabs = [];

definePageMetadata({
	title: i18n.ts.socialProofTesting,
	icon: 'ph-chart-line-bold ph-lg',
});
</script>

<style lang="scss" scoped>
.social-proof-test {
	padding: 16px;
}

.section {
	margin-bottom: 32px;
	
	h2, h3, h4 {
		margin-bottom: 16px;
		color: var(--fg);
	}
	
	p {
		color: var(--fgTransparentWeak);
		margin-bottom: 16px;
	}
}

.indicator-examples {
	display: flex;
	flex-wrap: wrap;
	gap: 16px;
	margin-bottom: 16px;
}

.demo-controls {
	display: flex;
	gap: 12px;
	margin-bottom: 24px;
}

.trending-notes {
	margin-top: 24px;
	
	.note-list {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	
	.note {
		border: 1px solid var(--divider);
		border-radius: 8px;
		overflow: hidden;
	}
}

.activity-data {
	margin-top: 24px;
}

.activity-stats {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
	gap: 16px;
	
	.stat {
		display: flex;
		flex-direction: column;
		padding: 16px;
		background: var(--panel);
		border-radius: 8px;
		
		.label {
			font-size: 0.9em;
			color: var(--fgTransparentWeak);
			margin-bottom: 4px;
		}
		
		.value {
			font-size: 1.5em;
			font-weight: bold;
			color: var(--accent);
		}
	}
}
</style>