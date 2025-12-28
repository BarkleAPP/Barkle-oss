<template>
	<MkContainer :show-header="widgetProps.showHeader" class="mkw-trends">
		<template #header>
			<i class="ph-fire-bold ph-lg"></i>{{ i18n.ts._widgets.trends }}
		</template>

		<div class="wbrkwala">
			<MkLoading v-if="fetching" />
			<div v-else-if="error" class="error">
				<i class="ph-warning-bold ph-lg"></i>
				<p>{{ i18n.ts.failedToLoad }}</p>
				<MkButton @click="fetchTrends" size="sm">{{ i18n.ts.retry }}</MkButton>
			</div>
			<transition-group v-else tag="div" :name="$store.state.animation ? 'trend-item' : ''" class="trends">
				<div v-for="(item, index) in trendingItems" :key="item.id" class="trend-item"
					:class="`trend-${item.type}`">
					<div class="trend-left">
						<div class="trend-rank">{{ index + 1 }}</div>
						<div class="trend-content">
							<div class="trend-header">
								<MkA class="trend-name" :to="getTrendUrl(item)" :title="item.name">
									<span v-if="item.type !== 'hashtag'" class="trend-icon">{{ getTrendIcon(item.type)
									}}</span>
									{{ item.displayName }}
								</MkA>
								<div class="trend-indicators">
									<span v-if="item.metadata.isHot" class="indicator hot" :title="i18n.ts.hotTrend">
										<i class="ph-fire-bold"></i>
									</span>
									<span v-if="item.metadata.isRising" class="indicator rising"
										:title="i18n.ts.risingTrend">
										<i class="ph-trend-up-bold"></i>
									</span>
								</div>
							</div>
							<div class="trend-stats">
								<span class="stat">
									<i class="ph-users-three-bold"></i>
									{{ formatNumber(item.volume) }}
								</span>
								<span v-if="item.metadata.category" class="category">
									{{ item.metadata.category }}
								</span>
								<span v-if="item.volumeChange > 20" class="volume-change positive">
									<i class="ph-arrow-up-bold"></i> {{ Math.round(item.volumeChange) }}%
								</span>
							</div>
						</div>
					</div>
					<div class="trend-chart" v-if="item.chart && item.chart.length > 0">
						<MkMiniChart class="chart" :src="item.chart" />
					</div>
				</div>
			</transition-group>
			<div v-if="!fetching && trendingItems.length === 0" class="empty">
				<i class="ph-hash-bold ph-lg"></i>
				<p>{{ i18n.ts.noTrendingItems }}</p>
			</div>
		</div>
	</MkContainer>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue';
import { useWidgetPropsManager, Widget, WidgetComponentExpose } from './widget';
import { GetFormResultType } from '@/scripts/form';
import MkContainer from '@/components/MkContainer.vue';
import MkMiniChart from '@/components/MkMiniChart.vue';
import MkButton from '@/components/MkButton.vue';
import * as os from '@/os';
import { useInterval } from '@/scripts/use-interval';
import { i18n } from '@/i18n';

const name = 'trends';

const widgetPropsDef = {
	showHeader: {
		type: 'boolean' as const,
		default: true,
	},
};

type WidgetProps = GetFormResultType<typeof widgetPropsDef>;

const props = defineProps<{ widget?: Widget<WidgetProps>; }>();
const emit = defineEmits<{ (ev: 'updateProps', props: WidgetProps); }>();

const { widgetProps, configure } = useWidgetPropsManager(name,
	widgetPropsDef,
	props,
	emit,
);

const trendingItems = ref([]);
const fetching = ref(true);
const error = ref(false);
const selectedTimeframe = ref('24h');

const fetchTrends = async () => {
	try {
		fetching.value = true;
		error.value = false;

		const response = await os.api('hashtags/trend', {
			timeframe: selectedTimeframe.value,
			limit: 10,
			includeTypes: ['hashtag', 'topic', 'content']
		});

		// Convert response to enhanced format
		trendingItems.value = (response || []).map((item: any) => {
			// Check if this is enhanced format or legacy format
			if (item.trendingScore !== undefined) {
				// Enhanced format - has the extra fields
				return {
					id: `hashtag:${item.tag}`,
					type: 'hashtag',
					name: item.tag,
					displayName: `#${item.tag}`,
					trendingScore: item.trendingScore,
					engagementVelocity: item.engagementVelocity || 0,
					viralityScore: item.trendingScore,
					volume: item.usersCount,
					volumeChange: item.volumeChange || 0,
					chart: item.chart || [],
					metadata: {
						isHot: item.isHot || false,
						isRising: item.isRising || false
					}
				};
			} else {
				// Legacy format - convert to enhanced format
				const volume = item.usersCount || 0;
				return {
					id: `hashtag:${item.tag}`,
					type: 'hashtag',
					name: item.tag,
					displayName: `#${item.tag}`,
					trendingScore: Math.max(volume * 10, 10), // Ensure minimum score
					engagementVelocity: 0,
					viralityScore: Math.max(volume * 5, 5),
					volume: volume,
					volumeChange: 0,
					chart: item.chart || [],
					metadata: {
						isHot: volume > 5, // Lower threshold for legacy
						isRising: volume > 2
					}
				};
			}
		}).filter(item => item.volume > 0); // Filter out empty items
	} catch (err) {
		console.error('Failed to fetch trending data:', err);
		error.value = true;
		// If the main API fails, try with basic parameters
		try {
			const fallbackResponse = await os.api('hashtags/trend', {});
			trendingItems.value = (fallbackResponse || []).map((item: any) => ({
				id: `hashtag:${item.tag}`,
				type: 'hashtag',
				name: item.tag,
				displayName: `#${item.tag}`,
				trendingScore: item.usersCount * 10,
				engagementVelocity: 0,
				viralityScore: 0,
				volume: item.usersCount,
				volumeChange: 0,
				chart: item.chart,
				metadata: {
					isHot: false,
					isRising: false
				}
			}));
			error.value = false;
		} catch (fallbackErr) {
			console.error('Fallback also failed:', fallbackErr);
		}
	} finally {
		fetching.value = false;
	}
};

const getTrendUrl = (item: any): string => {
	switch (item.type) {
		case 'hashtag':
			return `/tags/${encodeURIComponent(item.name)}`;
		case 'topic':
			return `/search?q=${encodeURIComponent(item.name)}`;
		case 'content':
			return `/notes/${item.name}`;
		default:
			return '#';
	}
};

const getTrendIcon = (type: string): string => {
	switch (type) {
		case 'hashtag': return '#';
		case 'topic': return '💬';
		case 'user': return '@';
		case 'content': return '📝';
		default: return '🔥';
	}
};

const formatNumber = (num: number): string => {
	if (num >= 1000000) {
		return (num / 1000000).toFixed(1) + 'M';
	} else if (num >= 1000) {
		return (num / 1000).toFixed(1) + 'K';
	}
	return num.toString();
};

// Watch for timeframe changes
watch(() => selectedTimeframe.value, () => {
	fetchTrends();
});

useInterval(fetchTrends, 1000 * 60 * 5, { // Refresh every 5 minutes
	immediate: true,
	afterMounted: true,
});

defineExpose<WidgetComponentExpose>({
	name,
	configure,
	id: props.widget ? props.widget.id : null,
});
</script>

<style lang="scss" scoped>
.wbrkwala {
	max-height: 600px;
	overflow-y: auto;

	.error {
		text-align: center;
		padding: 32px 16px;
		color: var(--error);

		i {
			margin-bottom: 8px;
		}

		p {
			margin: 8px 0;
		}
	}

	.empty {
		text-align: center;
		padding: 32px 16px;
		color: var(--fgTransparentWeak);

		i {
			margin-bottom: 8px;
		}

		p {
			margin: 8px 0;
		}
	}

	>.tags {
		.chart-move {
			transition: transform 1s ease;
		}

		>.trend-item {
			display: flex;
			align-items: center;
			padding: 14px 16px;
			border-bottom: solid 0.5px var(--divider);

			.trend-rank {
				font-size: 0.8em;
				font-weight: bold;
				color: var(--fgTransparentWeak);
				margin-right: 12px;
				min-width: 16px;
			}

			>.tag {
				flex: 1;
				overflow: hidden;
				font-size: 0.9em;
				color: var(--fg);

				>.a {
					display: block;
					width: 100%;
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
					line-height: 18px;
					text-decoration: none;
					color: var(--accent);
					font-weight: 600;

					&:hover {
						text-decoration: underline;
					}

					.hot-indicator {
						margin-left: 4px;
						color: #ff6b6b;
						font-size: 0.8em;
					}
				}

				>p {
					margin: 0;
					font-size: 75%;
					opacity: 0.7;
					line-height: 16px;
				}
			}

			>.chart {
				height: 30px;
			}
		}
	}

	.trends {
		.trend-item-move {
			transition: transform 0.5s ease;
		}

		.trend-item {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 10px 16px;
			border-bottom: solid 0.5px var(--divider);
			transition: background-color 0.2s ease;

			&:hover {
				background: var(--panelHighlight);
			}

			.trend-left {
				display: flex;
				align-items: center;
				flex: 1;
				min-width: 0;
				gap: 12px;

				.trend-rank {
					font-size: 1em;
					font-weight: 700;
					color: var(--fgTransparentWeak);
					min-width: 24px;
					text-align: center;
				}

				.trend-content {
					flex: 1;
					min-width: 0;

					.trend-header {
						display: flex;
						align-items: center;
						gap: 6px;
						margin-bottom: 4px;

						.trend-name {
							display: flex;
							align-items: center;
							font-weight: 600;
							font-size: 0.95em;
							color: var(--accent);
							text-decoration: none;
							white-space: nowrap;
							overflow: hidden;
							text-overflow: ellipsis;

							&:hover {
								text-decoration: underline;
							}

							.trend-icon {
								margin-right: 4px;
								font-size: 0.9em;
								opacity: 0.7;
							}
						}

						.trend-indicators {
							display: flex;
							align-items: center;
							gap: 4px;
							flex-shrink: 0;

							.indicator {
								display: flex;
								align-items: center;
								justify-content: center;
								width: 18px;
								height: 18px;
								border-radius: 50%;
								font-size: 0.7em;

								&.hot {
									background: rgba(255, 107, 107, 0.15);
									color: #ff6b6b;
								}

								&.rising {
									background: rgba(34, 197, 94, 0.15);
									color: #22c55e;
								}

								i {
									font-size: 11px;
								}
							}
						}
					}

					.trend-stats {
						display: flex;
						align-items: center;
						gap: 8px;
						font-size: 0.8em;
						color: var(--fgTransparentWeak);

						.stat {
							display: flex;
							align-items: center;
							gap: 4px;

							i {
								font-size: 0.9em;
							}
						}

						.category {
							font-size: 0.75em;
							color: var(--fgTransparentWeak);
							text-transform: uppercase;
							letter-spacing: 0.3px;
							font-weight: 500;
						}

						.volume-change {
							display: flex;
							align-items: center;
							gap: 2px;
							font-weight: 600;

							&.positive {
								color: #22c55e;
							}

							i {
								font-size: 0.85em;
							}
						}
					}
				}
			}

			.trend-chart {
				margin-left: 12px;
				flex-shrink: 0;

				.chart {
					height: 36px;
					width: 70px;
					opacity: 0.8;
				}
			}

			// Type-specific styling
			&.trend-hashtag {
				.trend-name {
					color: var(--accent);
				}
			}

			&.trend-topic {
				.trend-name {
					color: #8b5cf6;
				}
			}

			&.trend-content {
				.trend-name {
					color: #f59e0b;
				}
			}

			&.trend-user {
				.trend-name {
					color: #06b6d4;
				}
			}
		}
	}
}
</style>
