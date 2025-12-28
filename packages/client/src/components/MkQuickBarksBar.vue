<template>
	<!-- ALWAYS show the bar for debugging -->
	<div class="vjoppmmu" style="border: 3px solid lime; background: rgba(0,255,0,0.1); min-height: 100px;">
		<div style="padding: 10px; color: white; background: rgba(0,0,0,0.7);">
			DEBUG: User={{ $i ? 'LOGGED IN as ' + $i.username : 'NOT LOGGED IN' }} | Barks={{ quickBarks.length }} |
			Component Mounted={{ componentMounted }}
		</div>
		<div class="bark-item create" @click.stop="openCreator">
			<div class="avatar-wrapper">
				<img v-if="$i" :src="$i.avatarUrl" class="avatar" />
				<div class="add-icon"><i class="ti ti-plus"></i></div>
			</div>
			<div class="label">{{ i18n.ts._quickBark.yourQuickBark }}</div>
		</div>
		<div v-for="bark in groupedBarks" :key="bark.userId" class="bark-item" :class="{ viewed: bark.viewed }"
			@click.stop="openViewer(bark.userId)">
			<div class="avatar-wrapper">
				<img :src="bark.user.avatarUrl" class="avatar" />
				<div class="ring"></div>
			</div>
			<div class="label">{{ bark.user.name || bark.user.username }}</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue';
import type { QuickBark } from '@/types/quick-bark';
import * as os from '@/os';
import MkQuickBarksViewer from '@/components/MkQuickBarksViewer.vue';
import MkQuickBarkCreator from '@/components/MkQuickBarkCreator.vue';
import { $i } from '@/account';
import { i18n } from '@/i18n';

const quickBarks = ref<QuickBark[]>([]);
const componentMounted = ref(false);

// Group barks by user and track viewed status
const groupedBarks = computed(() => {
	const userMap = new Map();
	const viewedKey = 'quickBarks_viewed';
	const viewedItems = JSON.parse(localStorage.getItem(viewedKey) || '{}');

	quickBarks.value.forEach(bark => {
		if (!userMap.has(bark.userId)) {
			userMap.set(bark.userId, {
				userId: bark.userId,
				user: bark.user,
				barks: [],
				viewed: viewedItems[bark.userId] === bark.user.updatedAt || false,
			});
		}
		userMap.get(bark.userId).barks.push(bark);
	});
	return Array.from(userMap.values());
});

onMounted(async () => {
	componentMounted.value = true;
	console.log('=== QUICKBARKS BAR MOUNTED ===');
	console.log('User ($i):', $i);
	console.log('User logged in:', !!$i);
	try {
		console.log('Calling quick-barks/timeline API...');
		quickBarks.value = await os.api('quick-barks/timeline');
		console.log('API Response:', quickBarks.value);
		console.log('Number of barks:', quickBarks.value.length);
	} catch (error) {
		console.error('Failed to load Quick Barks:', error);
		console.error('Error details:', error);
	}
	console.log('=== QUICKBARKS BAR MOUNT COMPLETE ===');
});

function openViewer(userId: string) {
	os.popup(MkQuickBarksViewer, { userId }, {
		closed: () => {
			// Mark as viewed in localStorage
			const viewedKey = 'quickBarks_viewed';
			const viewedItems = JSON.parse(localStorage.getItem(viewedKey) || '{}');
			const group = groupedBarks.value.find(g => g.userId === userId);
			if (group) {
				viewedItems[userId] = group.user.updatedAt;
				localStorage.setItem(viewedKey, JSON.stringify(viewedItems));
				group.viewed = true;
			}
		}
	}, 'closed');
}

function openCreator() {
	os.popup(MkQuickBarkCreator, {}, {
		closed: async () => {
			// Reload barks after creating
			try {
				quickBarks.value = await os.api('quick-barks/timeline');
			} catch (error) {
				console.error('Failed to reload Quick Barks:', error);
			}
		}
	}, 'closed');
}
</script>

<style lang="scss" scoped>
.vjoppmmu {
	display: flex;
	gap: 12px;
	padding: 12px var(--margin);
	overflow-x: auto;
	overflow-y: hidden;
	-webkit-overflow-scrolling: touch;

	&::-webkit-scrollbar {
		display: none;
	}

	>.bark-item {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		cursor: pointer;
		user-select: none;

		>.avatar-wrapper {
			position: relative;
			width: 64px;
			height: 64px;

			>.avatar {
				width: 100%;
				height: 100%;
				border-radius: 100%;
				border: 3px solid var(--panel);
				object-fit: cover;
				pointer-events: none;
			}

			>.ring {
				position: absolute;
				inset: -3px;
				border-radius: 100%;
				background: linear-gradient(135deg, var(--accent) 0%, var(--accentLighten) 50%, var(--accent) 100%);
				pointer-events: none;
				z-index: -1;
			}

			>.add-icon {
				position: absolute;
				bottom: 0;
				right: 0;
				width: 20px;
				height: 20px;
				background: var(--accent);
				color: var(--fgOnAccent);
				border-radius: 100%;
				border: 2px solid var(--panel);
				display: flex;
				align-items: center;
				justify-content: center;
				font-size: 14px;

				>i {
					line-height: 1;
				}
			}
		}

		>.label {
			font-size: 0.85em;
			font-weight: 600;
			max-width: 64px;
			text-align: center;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		&.viewed {
			>.avatar-wrapper>.ring {
				background: var(--divider);
				opacity: 0.5;
			}
		}

		&.create {
			>.avatar-wrapper {
				border: 2px dashed var(--divider);
				border-radius: 100%;

				>.avatar {
					border: none;
				}

				>.ring {
					display: none;
				}
			}
		}

		&:hover {
			>.label {
				color: var(--accent);
			}
		}
	}
}
</style>