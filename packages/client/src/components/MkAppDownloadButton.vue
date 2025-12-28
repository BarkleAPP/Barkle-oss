<template>
<div v-if="shouldShowDownload" class="app-download-button">
	<div class="download-container">
		<div class="download-header">
			<i class="ph-device-mobile-bold ph-lg"></i>
			<span>{{ i18n.ts.downloadApp }}</span>
		</div>
		<div class="download-buttons">
			<!-- iOS App Store Button -->
			<a
				v-if="isIOS"
				href="https://apps.apple.com/us/app/barkle/id1661715919"
				target="_blank"
				rel="noopener noreferrer"
				class="store-button app-store"
			>
				<i class="ph-apple-logo-bold ph-lg"></i>
				<div class="button-text">
					<div class="small-text">{{ i18n.ts.downloadOn }}</div>
					<div class="large-text">App Store</div>
				</div>
			</a>

			<!-- Android Google Play Button -->
			<a
				v-if="isAndroid"
				href="https://play.google.com/store/apps/details?id=chat.barkle.app"
				target="_blank"
				rel="noopener noreferrer"
				class="store-button google-play"
			>
				<i class="ph-google-play-logo-bold ph-lg"></i>
				<div class="button-text">
					<div class="small-text">{{ i18n.ts.getItOn }}</div>
					<div class="large-text">Google Play</div>
				</div>
			</a>

			<!-- PWA Install Button (for web browsers) -->
			<button
				v-if="showPWAButton"
				@click="installPWA"
				class="store-button pwa-install"
			>
				<i class="ph-download-simple-bold ph-lg"></i>
				<div class="button-text">
					<div class="small-text">{{ i18n.ts.installApp }}</div>
					<div class="large-text">{{ i18n.ts.webApp }}</div>
				</div>
			</button>
		</div>
	</div>
</div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { i18n } from '@/i18n';
import { deviceKind } from '@/scripts/device-kind';

const props = withDefaults(defineProps<{
	inline?: boolean;
}>(), {
	inline: false,
});

const deferredPrompt = ref<any>(null);
const userAgent = navigator.userAgent.toLowerCase();

// Detect platform
const isIOS = computed(() => {
	return /iphone|ipad|ipod/.test(userAgent) && !window.MSStream;
});

const isAndroid = computed(() => {
	return /android/.test(userAgent);
});

const isMobile = computed(() => {
	return deviceKind === 'smartphone' || deviceKind === 'tablet';
});

// Show PWA button on mobile web browsers (not native apps)
const showPWAButton = computed(() => {
	return isMobile.value && !isRunningInApp.value && deferredPrompt.value !== null;
});

// Detect if running in native app (check for absence of browser chrome)
const isRunningInApp = computed(() => {
	// Check for standalone mode (PWA or native app)
	return window.matchMedia('(display-mode: standalone)').matches ||
		(window.navigator as any).standalone === true;
});

// Only show download buttons on mobile devices and not when already in app
const shouldShowDownload = computed(() => {
	return isMobile.value && !isRunningInApp.value;
});

// PWA installation
const installPWA = () => {
	if (deferredPrompt.value) {
		deferredPrompt.value.prompt();
		deferredPrompt.value.userChoice.then((choiceResult: any) => {
			if (choiceResult.outcome === 'accepted') {
				console.log('User accepted the PWA install prompt');
			}
			deferredPrompt.value = null;
		});
	}
};

onMounted(() => {
	// Listen for PWA install prompt
	window.addEventListener('beforeinstallprompt', (e) => {
		e.preventDefault();
		deferredPrompt.value = e;
	});
});
</script>

<style lang="scss" scoped>
.app-download-button {
	padding: 16px;
	margin: 12px 0;
	background: var(--panel);
	border-radius: 12px;
	border: 1px solid var(--divider);

	.download-container {
		.download-header {
			display: flex;
			align-items: center;
			gap: 8px;
			margin-bottom: 12px;
			font-weight: 600;
			color: var(--fg);
			font-size: 0.95em;

			i {
				font-size: 1.2em;
				color: var(--accent);
			}
		}

		.download-buttons {
			display: flex;
			flex-direction: column;
			gap: 8px;

			.store-button {
				display: flex;
				align-items: center;
				gap: 12px;
				padding: 12px 16px;
				border-radius: 8px;
				text-decoration: none;
				border: none;
				cursor: pointer;
				transition: all 0.2s ease;
				font-family: inherit;

				i {
					font-size: 2em;
				}

				.button-text {
					display: flex;
					flex-direction: column;
					align-items: flex-start;
					text-align: left;

					.small-text {
						font-size: 0.7em;
						opacity: 0.8;
					}

					.large-text {
						font-size: 0.95em;
						font-weight: 600;
					}
				}

				&.app-store {
					background: #000;
					color: #fff;

					&:hover {
						background: #1a1a1a;
						transform: translateY(-1px);
						box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
					}
				}

				&.google-play {
					background: #414141;
					color: #fff;

					&:hover {
						background: #525252;
						transform: translateY(-1px);
						box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
					}
				}

				&.pwa-install {
					background: var(--accent);
					color: var(--fgOnAccent);

					&:hover {
						background: var(--accentLighten);
						transform: translateY(-1px);
						box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
					}
				}
			}
		}
	}
}
</style>
