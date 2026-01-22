<template>
<MkStickyContainer>
	<template #header><MkPageHeader :actions="headerActions" :tabs="headerTabs"/></template>
	<MkSpacer :content-max="900">
		<div class="audit-logs">
			<div class="filters">
				<MkInput v-model="userId" style="margin: 0; flex: 1;" type="text" :spellcheck="false">
					<template #label>User ID</template>
				</MkInput>
			</div>

			<MkPagination v-slot="{items}" ref="pagination" :pagination="pagination" style="margin-top: var(--margin);">
				<div class="log-item" v-for="log in items" :key="log.id">
					<div class="log-header">
						<span class="log-type"><strong>{{ log.type }}</strong></span>
						<span class="log-date">{{ new Date(log.createdAt).toLocaleString() }}</span>
					</div>
					<div class="log-user" v-if="log.user">
						<MkAvatar :user="log.user" class="avatar" :show-indicator="true"/>
						<span class="username">@{{ log.user.username }}</span>
					</div>
					<div class="log-details" v-if="log.info">
						<pre>{{ JSON.stringify(log.info, null, 2) }}</pre>
					</div>
				</div>
			</MkPagination>
		</div>
	</MkSpacer>
</MkStickyContainer>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import MkInput from '@/components/form/input.vue';
import MkPagination from '@/components/MkPagination.vue';
import * as os from '@/os';
import { i18n } from '@/i18n';
import { definePageMetadata } from '@/scripts/page-metadata';

let pagination = $ref<InstanceType<typeof MkPagination>>();
let userId = $ref('');

const paginationProps = computed(() => ({
	endpoint: 'admin/show-moderation-logs' as const,
	limit: 20,
	params: computed(() => ({
		userId: userId || undefined,
	})),
}));

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: 'Audit Logs',
	icon: 'ph-clipboard-text-bold ph-lg',
});
</script>

<style lang="scss" scoped>
.audit-logs {
	margin: var(--margin);

	.filters {
		display: flex;
		gap: 8px;
		margin-bottom: 16px;
	}

	.log-item {
		padding: 16px;
		border: 1px solid var(--divider);
		border-radius: 8px;
		margin-bottom: 8px;

		.log-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 8px;

			.log-type {
				color: var(--accent);
			}

			.log-date {
				font-size: 0.85em;
				color: var(--fgTransparent);
			}
		}

		.log-user {
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

		.log-details {
			background: var(--bg);
			padding: 8px;
			border-radius: 4px;
			overflow-x: auto;

			pre {
				margin: 0;
				font-size: 0.85em;
				color: var(--fg);
			}
		}
	}
}
</style>
