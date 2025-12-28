<template>
	<Transition :name="$store.state.animation ? 'fade' : ''" appear @after-leave="emit('closed')">
		<div v-if="barks.length > 0" class="kpoogebi" @touchstart="handleTouchStart" 
			@touchmove="handleTouchMove" @touchend="handleTouchEnd">
			<!-- Progress bars at top -->
			<div class="progress-bars">
				<div v-for="(bark, index) in barks" :key="bark.id" class="progress-bar"
					:class="{ active: index === currentIndex, completed: index < currentIndex }">
					<div class="progress-fill" :style="{ width: getProgressWidth(index) + '%' }"></div>
				</div>
			</div>

			<!-- Header -->
			<header class="header">
				<div class="user" @click.stop>
					<MkAvatar :user="currentBark.user" class="avatar" :show-indicator="false" :disable-link="true" />
					<div class="name">
						<MkUserName :user="currentBark.user" :nowrap="true" />
						<MkTime :time="currentBark.createdAt" class="time" />
					</div>
				</div>
				<div class="header-actions">
					<button v-if="isMyBark" class="viewer-count-btn" @click.stop="showViewers">
						<i class="ti ti-eye"></i>
						<span>{{ viewerCount }}</span>
					</button>
					<button class="close-btn" @click.stop="close">
						<i class="ti ti-x"></i>
					</button>
				</div>
			</header>

			<!-- Main content area -->
			<div class="content-area" @mousedown="handleTap">
				<!-- Navigation zones (invisible tap areas) -->
				<div class="nav-zone prev" @click.stop="prevBark"></div>
				<div class="nav-zone next" @click.stop="nextBark"></div>

				<!-- Content -->
				<div class="bark-content">
					<img v-if="currentBark.type === 'image' || currentBark.type === 'gif'" :src="currentBark.file?.url"
						class="media-content" @load="onMediaLoaded" />
					<video v-else-if="currentBark.type === 'video'" :src="currentBark.file?.url" class="media-content"
						autoplay loop muted playsinline @loadeddata="onMediaLoaded"></video>
					<div v-else-if="currentBark.type === 'text'" class="text-content">
						<p>{{ currentBark.content }}</p>
					</div>

					<!-- Shared Note Card (Twitter Fleets style) -->
					<div v-if="currentBark.sharedNote" class="shared-note-card" @click.stop="openSharedNote">
						<div class="shared-note-header">
							<MkAvatar :user="currentBark.sharedNote.user" class="shared-avatar" :show-indicator="false" />
							<div class="shared-user-info">
								<MkUserName :user="currentBark.sharedNote.user" :nowrap="true" class="shared-username" />
								<span class="shared-handle">@{{ currentBark.sharedNote.user.username }}</span>
							</div>
						</div>
						<div class="shared-note-content">
							<Mfm v-if="currentBark.sharedNote.text" :text="currentBark.sharedNote.text" 
								:author="currentBark.sharedNote.user" :i="$i" 
								:custom-emojis="currentBark.sharedNote.emojis" class="shared-text" />
							<div v-if="currentBark.sharedNote.files && currentBark.sharedNote.files.length > 0" 
								class="shared-media-preview">
								<img v-if="currentBark.sharedNote.files[0].type.startsWith('image/')" 
									:src="currentBark.sharedNote.files[0].thumbnailUrl || currentBark.sharedNote.files[0].url" 
									class="shared-media-thumb" />
								<div v-else class="shared-media-icon">
									<i class="ti ti-file"></i>
								</div>
							</div>
						</div>
						<div class="shared-note-footer">
							<i class="ti ti-arrow-right"></i>
							<span>{{ i18n.ts._quickBark.viewBark || 'View bark' }}</span>
						</div>
					</div>
				</div>
			</div>

			<!-- Reply input at bottom -->
			<footer class="footer">
				<div class="reply-bar" @click.stop="replyViaDm">
					<div class="avatar-small">
						<MkAvatar v-if="$i" :user="$i" :show-indicator="false" :disable-link="true" />
					</div>
					<div class="reply-placeholder">
						{{ i18n.ts._quickBark.sendMessage || 'Send message' }}
					</div>
					<button class="action-btn" @click.stop="showMenu">
						<i class="ti ti-dots"></i>
					</button>
				</div>
			</footer>
		</div>
	</Transition>
</template>

<script lang="ts" setup>
import { ref, onMounted, computed, onUnmounted } from 'vue';
import type { QuickBark } from '@/types/quick-bark';
import * as os from '@/os';
import { i18n } from '@/i18n';
import { $i } from '@/account';

const props = defineProps<{
	userId: string;
	initialBarkId?: string;
}>();

const emit = defineEmits(['close', 'closed']);

const barks = ref<QuickBark[]>([]);
const currentIndex = ref(0);
const currentBark = computed(() => barks.value[currentIndex.value]);
const progressValue = ref(0);
let progressInterval: number | null = null;
const STORY_DURATION = 5000; // 5 seconds per story
const viewerCount = ref(0);
const isMyBark = computed(() => $i && currentBark.value && currentBark.value.userId === $i.id);

// Touch handling for swipe gestures
const touchStartX = ref(0);
const touchStartY = ref(0);
const touchStartTime = ref(0);
const isTouching = ref(false);

onMounted(async () => {
	try {
		barks.value = await os.api('quick-barks/user', { userId: props.userId });
		if (props.initialBarkId) {
			const initialIndex = barks.value.findIndex(b => b.id === props.initialBarkId);
			if (initialIndex !== -1) {
				currentIndex.value = initialIndex;
			}
		}
		await loadViewerCount();
		startProgress();
	} catch (error) {
		console.error('Failed to load barks:', error);
		close();
	}
});

onUnmounted(() => {
	stopProgress();
});

function startProgress() {
	stopProgress();
	progressValue.value = 0;
	const intervalTime = 50; // Update every 50ms
	const increment = (100 * intervalTime) / STORY_DURATION;

	progressInterval = window.setInterval(() => {
		progressValue.value += increment;
		if (progressValue.value >= 100) {
			nextBark();
		}
	}, intervalTime);
}

function stopProgress() {
	if (progressInterval) {
		clearInterval(progressInterval);
		progressInterval = null;
	}
}

function getProgressWidth(index: number): number {
	if (index < currentIndex.value) return 100;
	if (index === currentIndex.value) return progressValue.value;
	return 0;
}

function getTimeAgo(dateString: string): string {
	const now = new Date();
	const past = new Date(dateString);
	const diffMs = now.getTime() - past.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMins / 60);

	if (diffMins < 1) return i18n.ts.justNow || 'Just now';
	if (diffMins < 60) return `${diffMins}m`;
	if (diffHours < 24) return `${diffHours}h`;
	return `${Math.floor(diffHours / 24)}d`;
}

const prevBark = async () => {
	if (currentIndex.value > 0) {
		currentIndex.value--;
		await loadViewerCount();
		startProgress();
	} else {
		close();
	}
};

const nextBark = async () => {
	if (currentIndex.value < barks.value.length - 1) {
		currentIndex.value++;
		await loadViewerCount();
		startProgress();
	} else {
		close();
	}
};

function handleTap(e: MouseEvent) {
	const rect = (e.target as HTMLElement).getBoundingClientRect();
	const x = e.clientX - rect.left;
	const tapZone = rect.width / 3;
	
	if (x < tapZone) {
		prevBark();
	} else if (x > rect.width - tapZone) {
		nextBark();
	}
	// Middle zone pauses/resumes (handled by nav zones in template)
}

function handleTouchStart(e: TouchEvent) {
	if (e.touches.length > 0) {
		touchStartX.value = e.touches[0].clientX;
		touchStartY.value = e.touches[0].clientY;
		touchStartTime.value = Date.now();
		isTouching.value = true;
		stopProgress(); // Pause while touching
	}
}

function handleTouchMove(e: TouchEvent) {
	if (!isTouching.value || e.touches.length === 0) return;
	
	const touchX = e.touches[0].clientX;
	const touchY = e.touches[0].clientY;
	const deltaX = touchX - touchStartX.value;
	const deltaY = touchY - touchStartY.value;
	
	// Prevent default scrolling for horizontal swipes
	if (Math.abs(deltaX) > Math.abs(deltaY)) {
		e.preventDefault();
	}
}

function handleTouchEnd(e: TouchEvent) {
	if (!isTouching.value) return;
	isTouching.value = false;
	
	const touchEndX = e.changedTouches[0].clientX;
	const touchEndY = e.changedTouches[0].clientY;
	const deltaX = touchEndX - touchStartX.value;
	const deltaY = touchEndY - touchStartY.value;
	const deltaTime = Date.now() - touchStartTime.value;
	
	const minSwipeDistance = 50;
	const maxSwipeTime = 300;
	
	// Horizontal swipe (story navigation)
	if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
		if (deltaX > 0) {
			// Swipe right - previous story
			prevBark();
		} else {
			// Swipe left - next story
			nextBark();
		}
		return;
	}
	
	// Vertical swipe down (close)
	if (deltaY > minSwipeDistance && Math.abs(deltaY) > Math.abs(deltaX)) {
		close();
		return;
	}
	
	// Quick tap (not a swipe)
	if (deltaTime < maxSwipeTime && Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
		const tapZone = window.innerWidth / 3;
		if (touchEndX < tapZone) {
			prevBark();
		} else if (touchEndX > window.innerWidth - tapZone) {
			nextBark();
		}
	}
	
	// Resume progress
	startProgress();
}

function onMediaLoaded() {
	// Media loaded, continue with auto-advance
}

const loadViewerCount = async () => {
	if (!isMyBark.value) return;
	try {
		const viewers = await os.api('quick-barks/viewers', { quickBarkId: currentBark.value.id });
		viewerCount.value = viewers.length;
	} catch (error) {
		console.error('Failed to load viewer count:', error);
		viewerCount.value = 0;
	}
};

const showViewers = async () => {
	stopProgress();
	try {
		const viewers = await os.api('quick-barks/viewers', { quickBarkId: currentBark.value.id });
		viewerCount.value = viewers.length;

		// Show viewers in a simple dialog
		await os.alert({
			type: 'info',
			title: i18n.ts.viewers || 'Viewers',
			text: viewers.length > 0
				? viewers.map((v: any) => v.name || v.username).join(', ')
				: i18n.ts.noViewers || 'No viewers yet'
		});
	} catch (error) {
		console.error('Failed to load viewers:', error);
	}
	startProgress();
};

const replyViaDm = async () => {
	stopProgress();
	try {
		const { canceled, result: text } = await os.inputText({
			title: i18n.ts.sendMessage || 'Send Message',
			placeholder: i18n.ts.typeMessage || 'Type a message...',
		});

		if (!canceled && text) {
			await os.api('messaging/messages/create', {
				userId: currentBark.value.userId,
				text: text,
			});
			os.success();
		}
	} catch (error) {
		console.error('Failed to send message:', error);
		os.alert({
			type: 'error',
			text: i18n.ts.error || 'An error occurred',
		});
	}
	startProgress();
};

const showMenu = async () => {
	stopProgress();
	const isMyBark = currentBark.value.userId === props.userId;

	const items = [
		{
			text: i18n.ts.copyLink || 'Copy Link',
			icon: 'ti ti-link',
			action: () => {
				navigator.clipboard.writeText(`${location.origin}/quick-barks/${currentBark.value.id}`);
				os.success();
			}
		},
	];

	if (isMyBark) {
		items.push({
			text: i18n.ts.viewViewers || 'View Viewers',
			icon: 'ti ti-eye',
			action: showViewers
		});
		items.push({
			text: i18n.ts.delete || 'Delete',
			icon: 'ti ti-trash',
			danger: true,
			action: async () => {
				const { canceled } = await os.confirm({
					type: 'warning',
					text: i18n.ts.confirmDelete || 'Are you sure you want to delete this?',
				});
				if (!canceled) {
					await os.api('quick-barks/delete', { quickBarkId: currentBark.value.id });
					barks.value.splice(currentIndex.value, 1);
					if (barks.value.length === 0) {
						close();
					} else if (currentIndex.value >= barks.value.length) {
						currentIndex.value = barks.value.length - 1;
					}
				}
			}
		});
	} else {
		items.push({
			text: i18n.ts.report || 'Report',
			icon: 'ti ti-flag',
			danger: true,
			action: async () => {
				const { canceled, result: comment } = await os.inputText({
					title: i18n.ts.reportAbuse || 'Report',
					placeholder: i18n.ts.reportAbuseRenoteDescription || 'Describe the issue...',
				});

				if (!canceled && comment) {
					try {
						await os.api('users/report-abuse', {
							userId: currentBark.value.userId,
							comment: `QuickBark: ${currentBark.value.id}\n${comment}`,
						});
						await os.alert({
							type: 'success',
							text: i18n.ts.reportAbuseReportedThanks || 'Thank you for your report.',
						});
						close();
					} catch (error) {
						console.error('Failed to report:', error);
						os.alert({
							type: 'error',
							text: i18n.ts.error || 'An error occurred',
						});
					}
				}
			}
		});
	}

	await os.popupMenu(items);
	startProgress();
};

const openSharedNote = () => {
	if (!currentBark.value.sharedNote) return;
	stopProgress();
	// Navigate to the note page
	window.location.href = `/barks/${currentBark.value.sharedNote.id}`;
};

function close() {
	stopProgress();
	emit('close');
	emit('closed');
}
</script>

<style lang="scss" scoped>
.fade-enter-active,
.fade-leave-active {
	transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}

.kpoogebi {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	display: flex;
	flex-direction: column;
	z-index: 2000000;
	background: #000;
	touch-action: pan-y;
	user-select: none;
	overflow: hidden;

	>.progress-bars {
		position: absolute;
		top: max(env(safe-area-inset-top), 8px);
		left: 8px;
		right: 8px;
		display: flex;
		gap: 4px;
		z-index: 10;
		padding: 0 8px;

		>.progress-bar {
			flex: 1;
			height: 2px;
			background: rgba(255, 255, 255, 0.3);
			border-radius: 99px;
			overflow: hidden;

			>.progress-fill {
				height: 100%;
				background: #fff;
				transition: width 0.05s linear;
				border-radius: 99px;
			}

			&.completed>.progress-fill {
				width: 100% !important;
			}
		}
	}

	>.header {
		position: absolute;
		top: max(env(safe-area-inset-top, 8px), 20px);
		left: 0;
		right: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 16px;
		z-index: 10;
		background: linear-gradient(to bottom, rgba(0, 0, 0, 0.5) 0%, transparent 100%);
		padding-top: 12px;
		padding-bottom: 12px;

		>.user {
			display: flex;
			align-items: center;
			gap: 10px;
			min-width: 0;
			cursor: pointer;

			>.avatar {
				width: 32px;
				height: 32px;
				border: 2px solid #fff;
				border-radius: 50%;
			}

			>.name {
				min-width: 0;
				color: #fff;
				font-weight: 600;
				font-size: 14px;
				text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);

				>.time {
					display: block;
					font-size: 12px;
					opacity: 0.8;
					font-weight: 400;
				}
			}
		}

		>.header-actions {
			display: flex;
			align-items: center;
			gap: 8px;

			>.viewer-count-btn {
				display: flex;
				align-items: center;
				gap: 6px;
				padding: 6px 12px;
				border-radius: 20px;
				background: rgba(0, 0, 0, 0.3);
				backdrop-filter: blur(10px);
				border: none;
				color: #fff;
				cursor: pointer;
				font-size: 14px;
				font-weight: 600;
				transition: all 0.2s ease;

				i {
					font-size: 16px;
				}

				&:hover {
					background: rgba(0, 0, 0, 0.5);
				}

				&:active {
					transform: scale(0.95);
				}
			}

			>.close-btn {
				width: 32px;
				height: 32px;
				border-radius: 50%;
				background: rgba(0, 0, 0, 0.3);
				backdrop-filter: blur(10px);
				border: none;
				color: #fff;
				display: flex;
				align-items: center;
				justify-content: center;
				cursor: pointer;
				font-size: 20px;
				transition: all 0.2s ease;

				&:hover {
					background: rgba(0, 0, 0, 0.5);
				}

				&:active {
					transform: scale(0.9);
				}
			}
		}
	}

	>.content-area {
		flex: 1;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		margin-top: 0;

		>.nav-zone {
			position: absolute;
			top: 0;
			bottom: 0;
			width: 35%;
			z-index: 5;
			cursor: pointer;
			transition: background 0.2s ease;

			&.prev {
				left: 0;
			}

			&.next {
				right: 0;
			}

			// Optional: Show tap zones on hover (for desktop)
			&:active {
				background: rgba(255, 255, 255, 0.05);
			}
		}

		>.bark-content {
			width: 100%;
			height: 100%;
			display: flex;
			align-items: center;
			justify-content: center;
			position: relative;

			>.media-content {
				max-width: 100%;
				max-height: 100%;
				width: 100%;
				height: 100%;
				object-fit: contain;
				user-select: none;
				-webkit-user-drag: none;
			}

			>.text-content {
				padding: 32px;
				max-width: 500px;
				text-align: center;

				>p {
					font-size: clamp(24px, 6vw, 36px);
					font-weight: 700;
					line-height: 1.3;
					color: #fff;
					text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
				}
			}

			// Shared Note Card (Twitter Fleets style)
			>.shared-note-card {
				position: absolute;
				bottom: 100px;
				left: 16px;
				right: 16px;
				max-width: 500px;
				margin: 0 auto;
				background: rgba(255, 255, 255, 0.95);
				backdrop-filter: blur(10px);
				border-radius: 16px;
				padding: 16px;
				cursor: pointer;
				transition: all 0.2s ease;
				box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);

				&:hover {
					transform: translateY(-2px);
					box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
				}

				&:active {
					transform: translateY(0);
				}

				>.shared-note-header {
					display: flex;
					align-items: center;
					gap: 10px;
					margin-bottom: 12px;

					>.shared-avatar {
						width: 32px;
						height: 32px;
						flex-shrink: 0;
					}

					>.shared-user-info {
						flex: 1;
						min-width: 0;
						display: flex;
						flex-direction: column;
						gap: 2px;

						>.shared-username {
							font-weight: 700;
							font-size: 14px;
							color: #000;
						}

						>.shared-handle {
							font-size: 13px;
							color: #666;
						}
					}
				}

				>.shared-note-content {
					margin-bottom: 12px;

					>.shared-text {
						font-size: 15px;
						line-height: 1.5;
						color: #000;
						word-wrap: break-word;
						display: -webkit-box;
						-webkit-line-clamp: 3;
						-webkit-box-orient: vertical;
						overflow: hidden;
					}

					>.shared-media-preview {
						margin-top: 8px;
						border-radius: 12px;
						overflow: hidden;
						max-height: 120px;

						>.shared-media-thumb {
							width: 100%;
							height: auto;
							object-fit: cover;
							max-height: 120px;
						}

						>.shared-media-icon {
							display: flex;
							align-items: center;
							justify-content: center;
							padding: 20px;
							background: rgba(0, 0, 0, 0.05);
							color: #666;
							font-size: 32px;
						}
					}
				}

				>.shared-note-footer {
					display: flex;
					align-items: center;
					gap: 6px;
					color: #0084FF;
					font-size: 13px;
					font-weight: 600;

					i {
						font-size: 16px;
					}
				}
			}
		}
	}

	>.footer {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		padding: 16px;
		padding-bottom: max(env(safe-area-inset-bottom), 16px);
		z-index: 10;
		background: linear-gradient(to top, rgba(0, 0, 0, 0.5) 0%, transparent 100%);

		>.reply-bar {
			display: flex;
			align-items: center;
			gap: 12px;
			padding: 10px 14px;
			background: rgba(255, 255, 255, 0.1);
			backdrop-filter: blur(10px);
			border: 1px solid rgba(255, 255, 255, 0.2);
			border-radius: 24px;
			cursor: text;
			transition: all 0.2s ease;

			&:hover {
				background: rgba(255, 255, 255, 0.15);
				border-color: rgba(255, 255, 255, 0.3);
			}

			&:active {
				transform: scale(0.98);
			}

			>.avatar-small {
				width: 28px;
				height: 28px;
				border-radius: 50%;
				overflow: hidden;
				flex-shrink: 0;

				img {
					width: 100%;
					height: 100%;
					object-fit: cover;
				}
			}

			>.reply-placeholder {
				flex: 1;
				color: rgba(255, 255, 255, 0.7);
				font-size: 14px;
				user-select: none;
			}

			>.action-btn {
				width: 32px;
				height: 32px;
				border-radius: 50%;
				background: rgba(255, 255, 255, 0.1);
				border: none;
				color: #fff;
				display: flex;
				align-items: center;
				justify-content: center;
				cursor: pointer;
				font-size: 18px;
				flex-shrink: 0;
				transition: all 0.2s ease;

				&:hover {
					background: rgba(255, 255, 255, 0.2);
				}

				&:active {
					transform: scale(0.9);
				}
			}
		}
	}

	// Animations and transitions
	@media (prefers-reduced-motion: no-preference) {
		.bark-content {
			animation: fadeIn 0.2s ease;
		}
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
}
</style>
