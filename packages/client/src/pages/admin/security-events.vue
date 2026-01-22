<template>
<MkStickyContainer>
	<template #header><MkPageHeader :actions="headerActions" :tabs="headerTabs"/></template>
	<MkSpacer :content-max="900">
		<div class="security-events">
			<div class="stats-section" v-if="stats">
				<div class="stat-card">
					<span class="stat-value">{{ stats.totalEvents }}</span>
					<span class="stat-label">Total Events</span>
				</div>
				<div class="stat-card critical">
					<span class="stat-value">{{ stats.criticalEvents }}</span>
					<span class="stat-label">Critical</span>
				</div>
				<div class="stat-card high">
					<span class="stat-value">{{ stats.highSeverityEvents }}</span>
					<span class="stat-label">High Severity</span>
				</div>
				<div class="stat-card unreviewed">
					<span class="stat-value">{{ stats.unreviewedEvents }}</span>
					<span class="stat-label">Unreviewed</span>
				</div>
			</div>

			<div class="filters">
				<MkSelect v-model="type" style="flex: 1;">
					<template #label>Event Type</template>
					<option value="">All Types</option>
					<option value="signin_success">Sign In Success</option>
					<option value="signin_failure">Sign In Failure</option>
					<option value="rate_limit_exceeded">Rate Limit Exceeded</option>
					<option value="access_denied">Access Denied</option>
					<option value="security_violation">Security Violation</option>
					<option value="path_traversal_attempt">Path Traversal Attempt</option>
					<option value="sql_injection_attempt">SQL Injection Attempt</option>
					<option value="xss_attempt">XSS Attempt</option>
					<option value="prototype_pollution_attempt">Prototype Pollution Attempt</option>
				</MkSelect>
				<MkSelect v-model="severity" style="flex: 1;">
					<template #label>Severity</template>
					<option value="">All Severities</option>
					<option value="critical">Critical</option>
					<option value="high">High</option>
					<option value="medium">Medium</option>
					<option value="low">Low</option>
					<option value="info">Info</option>
				</MkSelect>
				<MkSwitch v-model="unreviewedOnly">
					<template #label>Unreviewed Only</template>
				</MkSwitch>
			</div>

			<MkPagination v-slot="{items}" ref="pagination" :pagination="pagination" style="margin-top: var(--margin);">
				<div class="event-item" v-for="event in items" :key="event.id" :class="'severity-' + event.severity">
					<div class="event-header">
						<span class="event-type">{{ formatEventType(event.type) }}</span>
						<span class="event-date">{{ new Date(event.createdAt).toLocaleString() }}</span>
						<span class="event-severity" :class="'severity-' + event.severity">{{ event.severity?.toUpperCase() }}</span>
					</div>
					<div class="event-user" v-if="event.user">
						<MkAvatar :user="event.user" class="avatar" :show-indicator="true"/>
						<span class="username">@{{ event.user.username }}</span>
					</div>
					<div class="event-info" v-if="event.ipAddress || event.userAgent">
						<span v-if="event.ipAddress" class="ip-address">IP: {{ event.ipAddress }}</span>
					</div>
					<div class="event-details" v-if="event.details">
						<pre>{{ JSON.stringify(event.details, null, 2) }}</pre>
					</div>
					<div class="event-actions">
						<MkButton v-if="!event.reviewed" @click="markAsReviewed(event.id)" primary small>Mark as Reviewed</MkButton>
					</div>
				</div>
			</MkPagination>
		</div>
	</MkSpacer>
</MkStickyContainer>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import MkSelect from '@/components/form/select.vue';
import MkSwitch from '@/components/form/switch.vue';
import MkPagination from '@/components/MkPagination.vue';
import MkButton from '@/components/MkButton.vue';
import * as os from '@/os';
import { i18n } from '@/i18n';
import { definePageMetadata } from '@/scripts/page-metadata';

let pagination = $ref<InstanceType<typeof MkPagination>>();
let type = $ref('');
let severity = $ref('');
let unreviewedOnly = $ref(false);
let stats = $ref<any>(null);

const paginationProps = computed(() => ({
	endpoint: 'admin/show-security-events' as const,
	limit: 20,
	params: computed(() => ({
		type: type || undefined,
		severity: severity || undefined,
		unreviewedOnly: unreviewedOnly || undefined,
	})),
}));

async function loadStats() {
	try {
		stats = await os.api('admin/get-security-stats');
	} catch (e) {
		console.error('Failed to load security stats:', e);
	}
}

function formatEventType(eventType: string): string {
	return eventType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

async function markAsReviewed(eventId: string) {
	try {
		await os.api('admin/mark-security-event-reviewed', { eventId });
		os.success();
		if (pagination) {
			pagination.reload();
		}
		loadStats();
	} catch (e) {
		os.alert({
			type: 'error',
			text: e.message || 'Failed to mark as reviewed',
		});
	}
}

onMounted(() => {
	loadStats();
});

const headerActions = $computed(() => [
	{
		icon: 'ph-arrows-clockwise-bold ph-lg',
		text: 'Refresh Stats',
		handler: loadStats,
	},
]);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: 'Security Events',
	icon: 'ph-shield-warning-bold ph-lg',
});
</script>

<style lang="scss" scoped>
.security-events {
	margin: var(--margin);

	.stats-section {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 12px;
		margin-bottom: 20px;

		.stat-card {
			background: var(--bg);
			padding: 16px;
			border-radius: 8px;
			border: 1px solid var(--divider);
			text-align: center;

			.stat-value {
				display: block;
				font-size: 1.5em;
				font-weight: bold;
				margin-bottom: 4px;
			}

			.stat-label {
				font-size: 0.85em;
				color: var(--fgTransparent);
			}

			&.critical {
				border-color: #ff4d4d;
				.stat-value {
					color: #ff4d4d;
				}
			}

			&.high {
				border-color: #ff9f43;
				.stat-value {
					color: #ff9f43;
				}
			}

			&.unreviewed {
				border-color: var(--accent);
				.stat-value {
					color: var(--accent);
				}
			}
		}
	}

	.filters {
		display: flex;
		gap: 8px;
		margin-bottom: 16px;
		flex-wrap: wrap;
	}

	.event-item {
		padding: 16px;
		border: 1px solid var(--divider);
		border-radius: 8px;
		margin-bottom: 8px;
		border-left: 4px solid var(--divider);

		&.severity-critical {
			border-left-color: #ff4d4d;
			background: rgba(255, 77, 77, 0.05);
		}

		&.severity-high {
			border-left-color: #ff9f43;
			background: rgba(255, 159, 67, 0.05);
		}

		&.severity-medium {
			border-left-color: #feca57;
		}

		&.severity-low {
			border-left-color: #48dbfb;
		}

		.event-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 8px;
			flex-wrap: wrap;
			gap: 8px;

			.event-type {
				font-weight: bold;
				color: var(--fg);
			}

			.event-date {
				font-size: 0.85em;
				color: var(--fgTransparent);
			}

			.event-severity {
				padding: 2px 8px;
				border-radius: 4px;
				font-size: 0.75em;
				font-weight: bold;
				text-transform: uppercase;

				&.severity-critical {
					background: #ff4d4d;
					color: white;
				}

				&.severity-high {
					background: #ff9f43;
					color: white;
				}

				&.severity-medium {
					background: #feca57;
					color: black;
				}

				&.severity-low {
					background: #48dbfb;
					color: black;
				}

				&.severity-info {
					background: var(--bg);
					color: var(--fg);
				}
			}
		}

		.event-user {
			display: flex;
			align-items: center;
			gap: 8px;
			margin-bottom: 8px;

			.avatar {
				width: 32px;
				height: 32px;
			}

			.username {
				font-weight: bold;
			}
		}

		.event-info {
			font-size: 0.9em;
			color: var(--fgTransparent);
			margin-bottom: 8px;

			.ip-address {
				margin-right: 16px;
			}
		}

		.event-details {
			background: var(--bg);
			padding: 8px;
			border-radius: 4px;
			overflow-x: auto;
			margin-bottom: 8px;

			pre {
				margin: 0;
				font-size: 0.85em;
				color: var(--fg);
			}
		}

		.event-actions {
			display: flex;
			gap: 8px;
		}
	}
}
</style>
