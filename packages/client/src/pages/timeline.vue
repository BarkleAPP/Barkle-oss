<template>
	<MkStickyContainer>
		<template #header>
			<MkPageHeader
				v-model:tab="src"
				:actions="headerActions"
				:tabs="headerTabs"
				:display-my-avatar="true"
				:text=true
			/>
		</template>
		<MkSpacer :content-max="800">
			<div ref="rootEl" v-hotkey.global="keymap" class="cmuxhskf">
				<MkQuickBarksBar class="_block" />
				<XPostForm
					v-if="$store.reactiveState.showFixedPostForm.value"
					class="post-form _block"
					fixed
				/>

				<!-- App Download Button for Mobile Timeline -->
				<MkAppDownloadButton v-if="isMobile" class="_block" style="margin-bottom: 16px;" />
	
				<div v-if="queue > 0" class="new">
					<button class="_buttonPrimary" @click="top()">
						{{ i18n.ts.newNoteRecived }}
					</button>
				</div>
				<!-- <div v-if="!isMobile" class="tl _block">
					<XTimeline
						ref="tl"
						:key="src"
						class="tl"
						:src="src"
						:sound="true"
						@queue="queueUpdated"
					/>
				</div> *v-else on next div* -->
				<div class="tl _block">
					<swiper
						:modules="[Virtual]"
						:space-between="20"
						:virtual="true"
						:allow-touch-move="!(deviceKind === 'desktop' && !defaultStore.state.swipeOnDesktop)"
						@swiper="setSwiperRef"
						@slide-change="onSlideChange"
					>
						<swiper-slide
							v-for="index in timelines"
							:key="index"
							:virtual-index="index"
						>
							<XTimeline
								ref="tl"
								:key="src"
								class="tl"
								:src="src"
								:sound="true"
								@queue="queueUpdated"
							/>
						</swiper-slide>
					</swiper>
				</div>
			</div>
		</MkSpacer>
	</MkStickyContainer>
	</template>
	
	<script lang="ts" setup>
	import { computed, watch, ref, onMounted } from 'vue';
	import { Virtual } from 'swiper';
	import { Swiper, SwiperSlide } from 'swiper/vue';
	//import XTutorial from '@/components/MkTutorialDialog.vue';
	import MkQuickBarksBar from '@/components/MkQuickBarksBar.vue';
	import XTimeline from '@/components/MkTimeline.vue';
	import XPostForm from '@/components/MkPostForm.vue';
	import MkAppDownloadButton from '@/components/MkAppDownloadButton.vue';
	import { scroll } from '@/scripts/scroll';
	import * as os from '@/os';
	import { defaultStore } from '@/store';
	import { i18n } from '@/i18n';
	import { instance } from '@/instance';
	import { $i } from '@/account';
	import { definePageMetadata } from '@/scripts/page-metadata';
	import { deviceKind } from '@/scripts/device-kind';
	import 'swiper/scss';
	import 'swiper/scss/virtual';
	
	/*if (defaultStore.reactiveState.tutorial.value !== -1) {
		os.popup(XTutorial, {}, {}, 'closed');
	}*/
	
	const isLocalTimelineAvailable =
		!instance.disableLocalTimeline ||
		($i != null && ($i.isModerator || $i.isAdmin));
	const isRecommendedTimelineAvailable = !instance.disableRecommendedTimeline;
	const isGlobalTimelineAvailable =
		!instance.disableGlobalTimeline ||
		($i != null && ($i.isModerator || $i.isAdmin));
	const keymap = {
		t: focus,
	};
	
	let timelines: string[] = [];
	
	// Only add social timeline for logged-in users
	if ($i != null && isLocalTimelineAvailable) {
		timelines.push('social');
	}
	
	// Only add home timeline for logged-in users
	if ($i != null) {
		timelines.push('home');
	} else {
		// For guests, use local timeline instead of social (which requires credentials)
		timelines.push('local');
	}
	
	// Add local timeline for logged-in users (guests already have it above)
	if ($i != null && isLocalTimelineAvailable) {
		timelines.push('local');
	}
	
	if (isGlobalTimelineAvailable) {
		timelines.push('global');
	}
	
	if (isRecommendedTimelineAvailable) {
		timelines.push('recommended');
	}	const MOBILE_THRESHOLD = 500;
	
	// デスクトップでウィンドウを狭くしたときモバイルUIが表示されて欲しいことはあるので deviceKind === 'desktop' の判定は行わない
	const isMobile = ref(
		deviceKind === 'smartphone' || window.innerWidth <= MOBILE_THRESHOLD,
	);
	window.addEventListener('resize', () => {
		isMobile.value =
			(deviceKind === 'smartphone' || window.innerWidth <= MOBILE_THRESHOLD);
	});
	
	const tlComponent = $ref<InstanceType<typeof XTimeline>>();
	const rootEl = $ref<HTMLElement>();
	
	let queue = $ref(0);
	const src = $computed({
		get: () => {
			const stored = defaultStore.reactiveState.tl.value.src;
			// For guests, if stored src is 'social' or 'home', default to 'local'
			if (!$i && (stored === 'social' || stored === 'home')) {
				return 'local';
			}
			// For logged-in users, if stored src is 'local' but social is available, default to 'social'
			if ($i && stored === 'local' && isLocalTimelineAvailable) {
				return 'social';
			}
			return stored || ($i != null ? 'social' : 'local');
		},
		set: (x) => {
			saveSrc(x);
			syncSlide(timelines.indexOf(x));
		},
	});
	
	watch($$(src), () => (queue = 0));
	
	function queueUpdated(q: number): void {
		queue = q;
	}
	
	function top(): void {
		scroll(rootEl, { top: 0 });
	}
	
	async function chooseList(ev: MouseEvent): Promise<void> {
		const lists = await os.api('users/lists/list');
		const items = [{
			type: 'link' as const,
			text: i18n.ts.manageLists,
			icon: 'ph-faders-horizontal-bold ph-lg',
			to: '/my/lists',
		}].concat(lists.map((list) => ({
			type: 'link' as const,
			text: list.name,
			icon: '',
			to: `/timeline/list/${list.id}`,
		})));
		os.popupMenu(items, ev.currentTarget ?? ev.target);
	}
	
	async function chooseAntenna(ev: MouseEvent): Promise<void> {
		const antennas = await os.api('antennas/list');
		const items = [{
			type: 'link' as const,
			indicate: false,
			text: i18n.ts.manageAntennas,
			icon: 'ph-faders-horizontal-bold ph-lg',
			to: '/my/antennas',
		}].concat(antennas.map((antenna) => ({
			type: 'link' as const,
			text: antenna.name,
			icon: '',
			indicate: antenna.hasUnreadNote,
			to: `/timeline/antenna/${antenna.id}`,
		})));
		os.popupMenu(items, ev.currentTarget ?? ev.target);
	}
	
	function saveSrc(
		newSrc: string,
	): void {
		defaultStore.set('tl', {
			...defaultStore.state.tl,
			src: newSrc,
		});
	}
	
	async function timetravel(): Promise<void> {
		const { canceled, result: date } = await os.inputDate({
			title: i18n.ts.date,
		});
		if (canceled) return;
	
		tlComponent.timetravel(date);
	}
	
	function focus(): void {
		tlComponent.focus();
	}
	
	const headerActions = $computed(() => [
	{
		icon: 'ph-list-bullets-bold ph-lg',
		title: i18n.ts.lists,
		iconOnly: true,
		handler: chooseList,
	} /* **TODO: fix timetravel** {
	icon: 'ph-calendar-blank-bold ph-lg',
	title: i18n.ts.jumpToSpecifiedDate,
	iconOnly: true,
	handler: timetravel,
}*/,
]);

const headerTabs = $computed(() => [
    // Only show social timeline for logged-in users
    ...($i != null && isLocalTimelineAvailable ? [{
        key: 'social',
        title: i18n.ts._timelines.social,
        icon: 'ph-handshake-bold ph-lg',
        iconOnly: true,
    }] : []),
    // Only show home timeline for logged-in users, trending for guests
    ...($i != null ? [{
        key: 'home',
        title: i18n.ts._timelines.home,
        icon: 'ph-house-bold ph-lg',
        iconOnly: true,
    }] : [{
        key: 'local',
        title: i18n.ts.featured,
        icon: 'ph-trend-up-bold ph-lg',
        iconOnly: true,
    }]),
    ...(isRecommendedTimelineAvailable
        ? [
            {
                key: 'recommended',
                title: i18n.ts._timelines.recommended,
                icon: 'ph-thumbs-up-bold ph-lg',
                iconOnly: true,
            },
        ]
        : []),
]);

definePageMetadata(
	computed(() => ({
		title: i18n.ts.timeline,
		icon:
			src === 'local' && !$i
				? 'ph-trend-up-bold ph-lg'
				: src === 'local'
					? 'ph-users-bold ph-lg'
					: src === 'social'
						? 'ph-handshake-bold ph-lg'
						: src === 'recommended'
							? 'ph-thumbs-up-bold ph-lg'
							: src === 'global'
								? 'ph-planet-bold ph-lg'
								: 'ph-house-bold ph-lg',
	})),
);
	
	let swiperRef: any = null;
	
	function setSwiperRef(swiper) {
		swiperRef = swiper;
		syncSlide(timelines.indexOf(src));
	}
	
	function onSlideChange() {
		saveSrc(timelines[swiperRef.activeIndex]);
	}
	
	function syncSlide(index) {
		swiperRef.slideTo(index);
	}
	
	onMounted(() => {
		syncSlide(timelines.indexOf(swiperRef.activeIndex));
	});
	
	</script>
	
	<style lang="scss" scoped>
	.cmuxhskf {
		--swiper-theme-color: var(--accent);
	
		> .new {
			position: sticky;
			top: calc(var(--stickyTop, 0px) + 16px);
			z-index: 1000;
			width: 100%;
	
			> button {
				display: block;
				margin: var(--margin) auto 0 auto;
				padding: 8px 16px;
				border-radius: 32px;
			}
		}
	
		> .post-form {
			border-radius: var(--radius);
		}
	
		> .tl {
			background: var(--bg);
			border-radius: var(--radius);
			overflow: clip;
		}
	}
	</style>
	