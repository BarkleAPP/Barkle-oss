<template>
<transition :name="$store.state.animation ? 'fade' : ''" mode="out-in">
	<MkLoading v-if="fetching"/>

	<MkError v-else-if="error" @retry="init()"/>

	<div v-else-if="empty" key="_empty_" class="empty">
		<slot name="empty">
			<div class="_fullinfo">
				<img src="/static-assets/badges/info.png" class="_ghost" alt="Error"/>
				<div>{{ i18n.ts.nothing }}</div>
			</div>
		</slot>
	</div>

	<div v-else ref="rootEl">
		<div v-show="pagination.reversed && more" key="_more_" class="cxiknjgy _gap">
			<MkButton v-if="!moreFetching" class="button" :disabled="moreFetching" :style="{ cursor: moreFetching ? 'wait' : 'pointer' }" primary @click="fetchMoreAhead">
				{{ i18n.ts.loadMore }}
			</MkButton>
			<MkLoading v-else class="loading"/>
		</div>
		<slot :items="items"></slot>
		<div v-show="!pagination.reversed && more && !caughtUp" key="_more_" class="cxiknjgy _gap">
			<MkButton v-if="!moreFetching" v-appear="($store.state.enableInfiniteScroll && !disableAutoLoad) ? fetchMore : null" class="button" :disabled="moreFetching" :style="{ cursor: moreFetching ? 'wait' : 'pointer' }" primary @click="fetchMore">
				{{ i18n.ts.loadMore }}
			</MkButton>
			<MkLoading v-else class="loading"/>
		</div>
		
		<!-- Caught up indicator -->
		<div v-if="caughtUp && caughtUpInfo" key="_caught_up_" class="caught-up-section _gap">
			<div class="caught-up-message">
				<div class="caught-up-icon">🎉</div>
				<div class="caught-up-text">
					<h3>{{ i18n.ts.caughtUp }}</h3>
					<p v-if="caughtUpInfo.daysSinceContent">
						{{ i18n.t('oldestContentDays', { days: caughtUpInfo.daysSinceContent }) }}
					</p>
				</div>
				<MkButton v-if="caughtUpInfo.oldestContentDate" @click="loadOlderContent">
					{{ i18n.ts.loadOlderContent }}
				</MkButton>
			</div>
		</div>
	</div>
</transition>
</template>

<script lang="ts" setup>
import { computed, ComputedRef, isRef, markRaw, onActivated, onDeactivated, Ref, ref, watch } from 'vue';
import * as misskey from 'calckey-js';
import * as os from '@/os';
import { onScrollTop, isTopVisible, getScrollPosition, getScrollContainer } from '@/scripts/scroll';
import MkButton from '@/components/MkButton.vue';
import { i18n } from '@/i18n';

export type Paging<E extends keyof misskey.Endpoints = keyof misskey.Endpoints> = {
	endpoint: E;
	limit: number;
	params?: misskey.Endpoints[E]['req'] | ComputedRef<misskey.Endpoints[E]['req']>;

	/**
	 * 検索APIのような、ページング不可なエンドポイントを利用する場合
	 * (そのようなAPIをこの関数で使うのは若干矛盾してるけど)
	 */
	noPaging?: boolean;

	/**
	 * items 配列の中身を逆順にする(新しい方が最後)
	 */
	reversed?: boolean;

	offsetMode?: boolean;

	/**
	 * Use cursor-based pagination instead of ID-based
	 */
	useCursor?: boolean;

	/**
	 * Enable infinite scroll behavior
	 */
	enableInfiniteScroll?: boolean;
};

const SECOND_FETCH_LIMIT = 30;

const props = withDefaults(defineProps<{
	pagination: Paging;
	disableAutoLoad?: boolean;
	displayLimit?: number;
}>(), {
	displayLimit: 30,
});

const emit = defineEmits<{
	(ev: 'queue', count: number): void;
}>();

type Item = { id: string; [another: string]: unknown; };

const rootEl = ref<HTMLElement>();
const items = ref<Item[]>([]);
const queue = ref<Item[]>([]);
const offset = ref(0);
const fetching = ref(true);
const moreFetching = ref(false);
const more = ref(false);
const backed = ref(false); // 遡り中か否か
const isBackTop = ref(false);
const empty = computed(() => items.value.length === 0);
const error = ref(false);

// Cursor-based pagination state
const cursor = ref<string>('0');
const caughtUp = ref(false);
const caughtUpInfo = ref<any>(null);

const init = async (): Promise<void> => {
	queue.value = [];
	fetching.value = true;
	cursor.value = '0';
	caughtUp.value = false;
	caughtUpInfo.value = null;
	
	const params = props.pagination.params ? isRef(props.pagination.params) ? props.pagination.params.value : props.pagination.params : {};
	const requestParams = {
		...params,
		limit: props.pagination.noPaging ? (props.pagination.limit || 10) : (props.pagination.limit || 10) + 1,
		...(props.pagination.useCursor && { cursor: cursor.value }),
	};

	await os.api(props.pagination.endpoint, requestParams).then(res => {
		// Handle both old format (array) and new format (object with pagination)
		let responseItems: any[];
		let newCursor: string | undefined;
		let hasMoreItems: boolean;
		let caughtUpStatus: any = null;

		if (Array.isArray(res)) {
			// Legacy format
			responseItems = res;
			hasMoreItems = !props.pagination.noPaging && (res.length > (props.pagination.limit || 10));
			if (hasMoreItems) {
				responseItems.pop();
			}
		} else {
			// New format with pagination metadata
			responseItems = res.notes || res.items || res;
			newCursor = res.cursor;
			hasMoreItems = res.hasMore !== false;
			caughtUpStatus = res.caughtUp;
		}

		// Add ad insertion logic
		for (let i = 0; i < responseItems.length; i++) {
			const item = responseItems[i];
			if (props.pagination.reversed) {
				if (i === responseItems.length - 2) item._shouldInsertAd_ = true;
			} else {
				if (i === 3) item._shouldInsertAd_ = true;
			}
		}

		items.value = props.pagination.reversed ? [...responseItems].reverse() : responseItems;
		more.value = hasMoreItems;
		
		if (props.pagination.useCursor && newCursor) {
			cursor.value = newCursor;
		}

		if (caughtUpStatus?.isCaughtUp) {
			caughtUp.value = true;
			caughtUpInfo.value = caughtUpStatus;
			more.value = false;
		}

		offset.value = responseItems.length;
		error.value = false;
		fetching.value = false;
	}, err => {
		error.value = true;
		fetching.value = false;
	});
};

const reload = (): void => {
	items.value = [];
	init();
};

const refresh = async (): void => {
	const params = props.pagination.params ? isRef(props.pagination.params) ? props.pagination.params.value : props.pagination.params : {};
	await os.api(props.pagination.endpoint, {
		...params,
		limit: items.value.length + 1,
		offset: 0,
	}).then(res => {
		let ids = items.value.reduce((a, b) => {
			a[b.id] = true;
			return a;
		}, {} as { [id: string]: boolean; });

		for (let i = 0; i < res.length; i++) {
			const item = res[i];
			if (!updateItem(item.id, old => item)) {
				append(item);
			}
			delete ids[item.id];
		}

		for (const id in ids) {
			removeItem(i => i.id === id);
		}
	}, err => {
		error.value = true;
		fetching.value = false;
	});
};

const fetchMore = async (): Promise<void> => {
	if (!more.value || fetching.value || moreFetching.value || items.value.length === 0 || caughtUp.value) return;
	moreFetching.value = true;
	backed.value = true;
	
	const params = props.pagination.params ? isRef(props.pagination.params) ? props.pagination.params.value : props.pagination.params : {};
	
	let requestParams: any = {
		...params,
		limit: SECOND_FETCH_LIMIT + 1,
	};

	// Use cursor-based pagination if enabled
	if (props.pagination.useCursor) {
		requestParams.cursor = cursor.value;
	} else if (props.pagination.offsetMode) {
		requestParams.offset = offset.value;
	} else if (props.pagination.reversed) {
		requestParams.sinceId = items.value[0].id;
	} else {
		requestParams.untilId = items.value[items.value.length - 1].id;
	}

	await os.api(props.pagination.endpoint, requestParams).then(res => {
		// Handle both old format (array) and new format (object with pagination)
		let responseItems: any[];
		let newCursor: string | undefined;
		let hasMoreItems: boolean;
		let caughtUpStatus: any = null;

		if (Array.isArray(res)) {
			// Legacy format
			responseItems = res;
			hasMoreItems = res.length > SECOND_FETCH_LIMIT;
			if (hasMoreItems) {
				responseItems.pop();
			}
		} else {
			// New format with pagination metadata
			responseItems = res.notes || res.items || res;
			newCursor = res.cursor;
			hasMoreItems = res.hasMore !== false && responseItems.length > 0;
			caughtUpStatus = res.caughtUp;
		}

		// Add ad insertion logic
		for (let i = 0; i < responseItems.length; i++) {
			const item = responseItems[i];
			if (props.pagination.reversed) {
				if (i === responseItems.length - 9) item._shouldInsertAd_ = true;
			} else {
				if (i === 10) item._shouldInsertAd_ = true;
			}
		}

		items.value = props.pagination.reversed ? 
			[...responseItems].reverse().concat(items.value) : 
			items.value.concat(responseItems);
		
		more.value = hasMoreItems;
		
		if (props.pagination.useCursor && newCursor) {
			cursor.value = newCursor;
		}

		if (caughtUpStatus?.isCaughtUp) {
			caughtUp.value = true;
			caughtUpInfo.value = caughtUpStatus;
			more.value = false;
		}

		offset.value += responseItems.length;
		moreFetching.value = false;
	}, err => {
		moreFetching.value = false;
	});
};

const fetchMoreAhead = async (): Promise<void> => {
	if (!more.value || fetching.value || moreFetching.value || items.value.length === 0) return;
	moreFetching.value = true;
	const params = props.pagination.params ? isRef(props.pagination.params) ? props.pagination.params.value : props.pagination.params : {};
	await os.api(props.pagination.endpoint, {
		...params,
		limit: SECOND_FETCH_LIMIT + 1,
		...(props.pagination.offsetMode ? {
			offset: offset.value,
		} : props.pagination.reversed ? {
			untilId: items.value[0].id,
		} : {
			sinceId: items.value[items.value.length - 1].id,
		}),
	}).then(res => {
		if (res.length > SECOND_FETCH_LIMIT) {
			res.pop();
			items.value = props.pagination.reversed ? [...res].reverse().concat(items.value) : items.value.concat(res);
			more.value = true;
		} else {
			items.value = props.pagination.reversed ? [...res].reverse().concat(items.value) : items.value.concat(res);
			more.value = false;
		}
		offset.value += res.length;
		moreFetching.value = false;
	}, err => {
		moreFetching.value = false;
	});
};

const prepend = (item: Item): void => {
	if (props.pagination.reversed) {
		if (rootEl.value) {
			const container = getScrollContainer(rootEl.value);
			if (container == null) {
				// TODO?
			} else {
				const pos = getScrollPosition(rootEl.value);
				const viewHeight = container.clientHeight;
				const height = container.scrollHeight;
				const isBottom = (pos + viewHeight > height - 32);
				if (isBottom) {
					// オーバーフローしたら古いアイテムは捨てる
					if (items.value.length >= props.displayLimit) {
						// このやり方だとVue 3.2以降アニメーションが動かなくなる
						//items.value = items.value.slice(-props.displayLimit);
						while (items.value.length >= props.displayLimit) {
							items.value.shift();
						}
						more.value = true;
					}
				}
			}
		}
		items.value.push(item);
		// TODO
	} else {
		// 初回表示時はunshiftだけでOK
		if (!rootEl.value) {
			items.value.unshift(item);
			return;
		}

		const isTop = isBackTop.value || (document.body.contains(rootEl.value) && isTopVisible(rootEl.value));

		if (isTop) {
			// Prepend the item
			items.value.unshift(item);

			// オーバーフローしたら古いアイテムは捨てる
			if (items.value.length >= props.displayLimit) {
				// このやり方だとVue 3.2以降アニメーションが動かなくなる
				//this.items = items.value.slice(0, props.displayLimit);
				while (items.value.length >= props.displayLimit) {
					items.value.pop();
				}
				more.value = true;
			}
		} else {
			queue.value.push(item);
			onScrollTop(rootEl.value, () => {
				for (const queueItem of queue.value) {
					prepend(queueItem);
				}
				queue.value = [];
			});
		}
	}
};

const append = (item: Item): void => {
	items.value.push(item);
};

const removeItem = (finder: (item: Item) => boolean): boolean => {
	const i = items.value.findIndex(finder);
	if (i === -1) {
		return false;
	}

	items.value.splice(i, 1);
	return true;
};

const updateItem = (id: Item['id'], replacer: (old: Item) => Item): boolean => {
	const i = items.value.findIndex(item => item.id === id);
	if (i === -1) {
		return false;
	}

	items.value[i] = replacer(items.value[i]);
	return true;
};

const loadOlderContent = async (): Promise<void> => {
	if (!caughtUp.value) return;
	
	// Reset caught up state and continue loading
	caughtUp.value = false;
	caughtUpInfo.value = null;
	more.value = true;
	
	await fetchMore();
};

if (props.pagination.params && isRef(props.pagination.params)) {
	watch(props.pagination.params, init, { deep: true });
}

watch(queue, (a, b) => {
	if (a.length === 0 && b.length === 0) return;
	emit('queue', queue.value.length);
}, { deep: true });

init();

onActivated(() => {
	isBackTop.value = false;
});

onDeactivated(() => {
	isBackTop.value = window.scrollY === 0;
});

defineExpose({
	items,
	queue,
	backed,
	reload,
	refresh,
	prepend,
	append,
	removeItem,
	updateItem,
});
</script>

<style lang="scss" scoped>
.fade-enter-active,
.fade-leave-active {
	transition: opacity 0.125s ease;
}
.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}

.cxiknjgy {
	> .button {
		margin-left: auto;
		margin-right: auto;
	}
}

.caught-up-section {
	padding: 32px 16px;
	text-align: center;

	.caught-up-message {
		background: var(--panel);
		border-radius: var(--radius);
		padding: 24px;
		max-width: 400px;
		margin: 0 auto;

		.caught-up-icon {
			font-size: 2rem;
			margin-bottom: 16px;
		}

		.caught-up-text {
			margin-bottom: 16px;

			h3 {
				margin: 0 0 8px 0;
				color: var(--accent);
				font-size: 1.2rem;
			}

			p {
				margin: 0;
				color: var(--fgTransparentWeak);
				font-size: 0.9rem;
			}
		}
	}
}
</style>
