<template>
<div class="dkgtipfy" :class="{ wallpaper }">
	<XSidebar v-if="!isMobile" class="sidebar"/>

	<MkStickyContainer class="contents">
		<main id="maincontent" style="min-width: 0;" :style="{ background: pageMetadata?.value?.bg }" @contextmenu.stop="onContextmenu">
			<div :class="$style.content">
				<RouterView/>
			</div>
			<div :class="$style.spacer"></div>
		</main>
	</MkStickyContainer>

	<div v-if="isDesktop && !shouldHideWidgets" ref="widgetsEl" class="widgets">
		<XWidgets @mounted="attachSticky"/>
	</div>

	<button v-if="!isDesktop && !isMobile && !shouldHideWidgets" class="widgetButton _button" @click="widgetsShowing = true"><i class="ph-stack-bold ph-lg"></i></button>

	<div v-if="isMobile && !isMessagingRoute" class="buttons">
		<button class="button home _button" @click="mainRouter.currentRoute.value.name === 'index' ? top() : mainRouter.push('/'); updateButtonState();">
			<div class="button-wrapper" :class="buttonAnimIndex === 0 ? 'on' : ''">
				<i class="ph-house-bold ph-lg"></i>
			</div>
		</button>
		<button class="button explore _button" @click="mainRouter.push('/explore'); updateButtonState();">
			<div class="button-wrapper" :class="buttonAnimIndex === 1 ? 'on' : ''">
				<i class="ph-hash-bold ph-lg"></i>
			</div>
		</button>
		<button class="button search _button" @click="search()">
			<div class="button-wrapper">
				<i class="ph-magnifying-glass-bold ph-lg"></i>
			</div>
		</button>
		<button class="button widget _button" @click="widgetsShowing = true">
			<div class="button-wrapper">
				<i class="ph-stack-bold ph-lg"></i>
			</div>
		</button>
	</div>

	<!-- Login/Signup buttons instead of post button -->
	<div v-if="isMobile" class="auth-buttons-mobile">
		<button class="auth-button login _button" @click="signin()"><i class="ph-sign-in-bold ph-lg"></i></button>
		<button class="auth-button signup _buttonGradate" @click="signup()"><i class="ph-user-plus-bold ph-lg"></i></button>
	</div>

	<transition :name="defaultStore.state.animation ? 'menuDrawer-back' : ''">
		<div
			v-if="drawerMenuShowing"
			class="menuDrawer-back _modalBg"
			@click="drawerMenuShowing = false"
			@touchstart.passive="drawerMenuShowing = false"
		></div>
	</transition>

	<transition :name="defaultStore.state.animation ? 'menuDrawer' : ''">
		<XDrawerMenu v-if="drawerMenuShowing" :isDrawer="true" class="menuDrawer"/>
	</transition>

	<transition :name="defaultStore.state.animation ? 'widgetsDrawer-back' : ''">
		<div
			v-if="widgetsShowing"
			class="widgetsDrawer-back _modalBg"
			@click="widgetsShowing = false"
			@touchstart.passive="widgetsShowing = false"
		></div>
	</transition>

	<transition :name="defaultStore.state.animation ? 'widgetsDrawer' : ''">
		<XWidgets v-if="widgetsShowing" class="widgetsDrawer"/>
	</transition>

	<XCommon/>
</div>
</template>

<script lang="ts" setup>
import { defineAsyncComponent, provide, onMounted, computed, ref } from 'vue';
import type { ComputedRef } from 'vue';
import type { PageMetadata } from '@/scripts/page-metadata';
import { instanceName } from '@/config';
import { StickySidebar } from '@/scripts/sticky-sidebar';
import XDrawerMenu from '@/ui/_common_/navbar-guest.vue';
import XCommon from './_common_/common.vue';
import * as os from '@/os';
import { defaultStore } from '@/store';
import { i18n } from '@/i18n';
import { mainRouter } from '@/router';
import { provideMetadataReceiver } from '@/scripts/page-metadata';
import { deviceKind } from '@/scripts/device-kind';
import { search } from '@/scripts/search';

const XWidgets = defineAsyncComponent(() => import('./universal.widgets.vue'));
const XSidebar = defineAsyncComponent(() => import('@/ui/_common_/navbar-guest.vue'));

const DESKTOP_THRESHOLD = 1100;
const MOBILE_THRESHOLD = 500;

// デスクトップでウィンドウを狭くしたときモバイルUIが表示されて欲しいことはあるので deviceKind === 'desktop' の判定は行わない
const isDesktop = ref(window.innerWidth >= DESKTOP_THRESHOLD);
const isMobile = ref(deviceKind === 'smartphone' || window.innerWidth <= MOBILE_THRESHOLD);
window.addEventListener('resize', () => {
	isMobile.value = deviceKind === 'smartphone' || window.innerWidth <= MOBILE_THRESHOLD;
});
const isMessagingRoute = computed(() => {
	const currentRoute = mainRouter.currentRoute.value;
	// Only hide navigation when actually in a conversation, not just on messaging page
	return currentRoute.name === 'messageUI';
});

const isLiveRoute = computed(() => {
	const currentRoute = mainRouter.currentRoute.value;
	return currentRoute.name === 'user-live';
});

const shouldHideWidgets = computed(() => {
	return isLiveRoute.value || isMobile.value;
});

const buttonAnimIndex = ref(0);
const drawerMenuShowing = ref(false);

let pageMetadata: ComputedRef<PageMetadata> | null = null;
const widgetsEl = ref<HTMLElement>();
const widgetsShowing = ref(false);

provide('router', mainRouter);
provideMetadataReceiver((info) => {
	pageMetadata = info;
	if (pageMetadata?.value) {
		document.title = `${pageMetadata.value.title} | ${instanceName}`;
	}
});

function updateButtonState(): void {
	let routerState = window.location.pathname;
	if (routerState === '/') {
		buttonAnimIndex.value = 0;
		return;
	}
	if (routerState.includes('/explore')) {
		buttonAnimIndex.value = 1;
		return;
	}
	buttonAnimIndex.value = 2;
	return;
}

updateButtonState();

document.documentElement.style.overflowY = 'scroll';

if (defaultStore.state.widgets.length === 0) {
	defaultStore.set('widgets', [{
		name: 'calendar',
		id: 'a', place: 'right', data: {},
	}, {
		name: 'trends',
		id: 'c', place: 'right', data: {},
	}]);
}

onMounted(() => {
	if (!isDesktop.value) {
		window.addEventListener('resize', () => {
			if (window.innerWidth >= DESKTOP_THRESHOLD) isDesktop.value = true;
		}, { passive: true });
	}
});

const onContextmenu = (ev: MouseEvent) => {
	const isLink = (el: HTMLElement) => {
		if (el.tagName === 'A') return true;
		if (el.parentElement) {
			return isLink(el.parentElement);
		}
		return false;
	};
	if (isLink(ev.target as HTMLElement)) return;
	if (['INPUT', 'TEXTAREA', 'IMG', 'VIDEO', 'CANVAS'].includes((ev.target as HTMLElement).tagName) || (ev.target as HTMLElement).hasAttribute('contenteditable')) return;
	if (window.getSelection()?.toString() !== '') return;
	const path = mainRouter.getCurrentPath();
	os.popupMenu([{
		type: 'label',
		text: path,
	}, {
		icon: 'ph-browser-bold ph-lg',
		text: i18n.ts.openInWindow,
		action: () => {
			os.pageWindow(path);
		},
	}], ev.currentTarget as HTMLElement, {
		align: 'left',
	});
};

const attachSticky = (el: any) => {
	const sticky = new StickySidebar(widgetsEl.value!);
	window.addEventListener('scroll', () => {
		sticky.calc(window.scrollY);
	}, { passive: true });
};

function top() {
	window.scroll({ top: 0, behavior: 'smooth' });
}

function signin() {
	os.popup(defineAsyncComponent(() => import('@/components/MkSigninDialog.vue')), {}, {}, 'closed');
}

function signup() {
	os.popup(defineAsyncComponent(() => import('@/components/MkSignupDialog.vue')), {}, {}, 'closed');
}

const wallpaper = localStorage.getItem('wallpaper') != null;

</script>

<style lang="scss" scoped>
.widgetsDrawer-enter-active,
.widgetsDrawer-leave-active {
	opacity: 1;
	transform: translateX(0);
	transition: transform 300ms cubic-bezier(0.23, 1, 0.32, 1), opacity 300ms cubic-bezier(0.23, 1, 0.32, 1);
}
.widgetsDrawer-enter-from,
.widgetsDrawer-leave-active {
	opacity: 0;
	transform: translateX(240px);
}

.widgetsDrawer-back-enter-active,
.widgetsDrawer-back-leave-active {
	opacity: 1;
	transition: opacity 300ms cubic-bezier(0.23, 1, 0.32, 1);
}
.widgetsDrawer-back-enter-from,
.widgetsDrawer-leave-active {
	opacity: 0;
}

.menuDrawer-enter-active,
.menuDrawer-leave-active {
	opacity: 1;
	transform: translateX(0);
	transition: transform 300ms cubic-bezier(0.23, 1, 0.32, 1), opacity 300ms cubic-bezier(0.23, 1, 0.32, 1);
}
.menuDrawer-enter-from,
.menuDrawer-leave-active {
	opacity: 0;
	transform: translateX(-240px);
}

.menuDrawer-back-enter-active,
.menuDrawer-back-leave-active {
	opacity: 1;
	transition: opacity 300ms cubic-bezier(0.23, 1, 0.32, 1);
}
.menuDrawer-back-enter-from,
.menuDrawer-leave-active {
	opacity: 0;
}

.dkgtipfy {
	$ui-font-size: 1em; // TODO: どこかに集約したい
	$widgets-hide-threshold: 1090px;

	// ほんとは単に 100vh と書きたいところだが... https://css-tricks.com/the-trick-to-viewport-units-on-mobile/
	min-height: calc(var(--vh, 1vh) * 100);
	box-sizing: border-box;
	display: flex;

	&.wallpaper {
		background: var(--wallpaperOverlay);
		//backdrop-filter: var(--blur, blur(4px));
	}

	> .sidebar {
		border-right: solid 0.5px var(--divider);
	}

	> .contents {
		width: 100%;
		min-width: 0;
		background: var(--bg);
	}

	> .widgets {
		padding: 0 var(--margin);
		border-left: solid 0.5px var(--divider);
		background: var(--bg);

		@media (max-width: $widgets-hide-threshold) {
			display: none;
		}
	}

	> .widgetsDrawer-back {
		z-index: 1001;
	}

	> .widgetsDrawer {
		position: fixed;
		top: 0;
		right: 0;
		z-index: 1001;
		// ほんとは単に 100vh と書きたいところだが... https://css-tricks.com/the-trick-to-viewport-units-on-mobile/
		height: calc(var(--vh, 1vh) * 100);
		padding: var(--margin);
		box-sizing: border-box;
		overflow: auto;
		overscroll-behavior: contain;
		background: var(--bg);
	}

	> .auth-buttons-mobile {
		position: fixed;
		z-index: 1000;
		bottom: 0;
		left: 0;
		padding: 12px 12px calc(env(safe-area-inset-bottom, 0px) + 12px) 12px;
		display: flex;
		width: 100%;
		box-sizing: border-box;
		background-color: var(--bg);
		justify-content: center;
		gap: 12px;

		> .auth-button {
			flex: 1;
			max-width: 120px;
			height: 3.5rem;
			border-radius: 8px;
			background-position: center;
			transition: background 0.6s;
			color: var(--fg);
			font-size: 14px;
			font-weight: 600;

			&:active {
				background-color: var(--accentedBg);
				background-size: 100%;
				transition: background 0.1s;
			}

			&.login {
				background: transparent;
				border: 2px solid var(--accent);
				color: var(--accent);

				&:hover {
					background: rgba(var(--accent), 0.1);
				}
			}

			&.signup {
				background: var(--accent);
				border: none;
				color: var(--fgOnAccent);

				&:hover {
					background: var(--accentLighten);
				}
			}
		}
	}

	> .buttons {
		position: fixed;
		z-index: 1000;
		bottom: 0;
		left: 0;
		padding: 12px 12px calc(env(safe-area-inset-bottom, 0px) + 80px) 12px; // Extra padding for auth buttons
		display: flex;
		width: 100%;
		box-sizing: border-box;
		background-color: var(--bg);

		> .button {
			position: relative;
			flex: 1;
			padding: 0;
			margin: auto;
			height: 3.5rem;
			border-radius: 8px;
			background-position: center;
			transition: background 0.6s;
			color: var(--fg);

			&:active {
				background-color: var(--accentedBg);
				background-size: 100%;
				transition: background 0.1s;
			}

			> .button-wrapper {

				> i {
					transform: translateY(0.05em);
				}

				&.on {
					background-color: var(--accentedBg);
					width: 100%;
					border-radius: 999px;
					transform: translateY(-0.5em);
					transition: all 0.2s ease-in-out;
				}

				> .indicator {
					position: absolute;
					top: 0;
					left: 0;
					color: var(--indicator);
					font-size: 16px;
					animation: blink 1s infinite;
				}
			}

			&:not(:last-child) {
				margin-right: 12px;
			}

			@media (max-width: 400px) {
				height: 60px;

				&:not(:last-child) {
					margin-right: 8px;
				}
			}
			> .indicator {
				position: absolute;
				top: 0;
				left: 0;
				color: var(--indicator);
				font-size: 16px;
				animation: blink 1s infinite;
			}

			&:first-child {
				margin-left: 0;
			}

			&:last-child {
				margin-right: 0;
			}

			> * {
				font-size: 16px;
			}

			&:disabled {
				cursor: default;

				> * {
					opacity: 0.5;
				}
			}
		}
	}

	> .menuDrawer-back {
		z-index: 1001;
	}

	> .menuDrawer {
		position: fixed;
		top: 0;
		left: 0;
		z-index: 1001;
		// ほんとは単に 100vh と書きたいところだが... https://css-tricks.com/the-trick-to-viewport-units-on-mobile/
		height: calc(var(--vh, 1vh) * 100);
		width: 240px;
		box-sizing: border-box;
		contain: strict;
		overflow: auto;
		overscroll-behavior: contain;
		background: var(--navBg);
	}
}
</style>

<style lang="scss" module>
.statusbars {
	position: sticky;
	top: 0;
	left: 0;
}

.spacer {
	$widgets-hide-threshold: 1090px;

	height: calc(env(safe-area-inset-bottom, 0px) + 140px); // Extra space for auth buttons

	@media (min-width: ($widgets-hide-threshold + 1px)) {
		display: none;
	}
}
</style>
