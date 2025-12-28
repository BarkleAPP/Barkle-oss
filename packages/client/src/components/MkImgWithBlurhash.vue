<template>
	<div class="xubzgfgb" :class="{ cover }" :title="title">
		<canvas v-if="!loaded" ref="canvas" :width="size" :height="size" :title="title" />
		<picture v-if="src">
			<source v-if="avifSrc" type="image/avif" :srcset="avifSrc">
			<source v-if="webpSrc" type="image/webp" :srcset="webpSrc">
			<img :src="src" :title="title" :alt="alt" @load="onLoad" decoding="async" loading="lazy" />
		</picture>
	</div>
</template>

<script lang="ts" setup>
import { onMounted } from 'vue';
import { decode } from 'blurhash';

const props = withDefaults(defineProps<{
	src?: string | null;
	hash?: string;
	alt?: string;
	title?: string | null;
	size?: number;
	cover?: boolean;
}>(), {
	src: null,
	alt: '',
	title: null,
	size: 64,
	cover: true,
});

const canvas = $ref<HTMLCanvasElement>();
let loaded = $ref(false);

// Generate WebP and AVIF versions of the image URL
const webpSrc = $computed(() => {
	if (!props.src) return null;
	// Try to replace extension with .webp, or add .webp suffix for dynamic URLs
	if (props.src.match(/\.(png|jpg|jpeg)$/i)) {
		return props.src.replace(/\.(png|jpg|jpeg)$/i, '.webp');
	}
	return null;
});

const avifSrc = $computed(() => {
	if (!props.src) return null;
	// Try to replace extension with .avif, or add .avif suffix for dynamic URLs
	if (props.src.match(/\.(png|jpg|jpeg)$/i)) {
		return props.src.replace(/\.(png|jpg|jpeg)$/i, '.avif');
	}
	return null;
});

function draw() {
	if (props.hash == null) return;
	const pixels = decode(props.hash, props.size, props.size);
	const ctx = canvas.getContext('2d');
	const imageData = ctx!.createImageData(props.size, props.size);
	imageData.data.set(pixels);
	ctx!.putImageData(imageData, 0, 0);
}

function onLoad() {
	loaded = true;
}

onMounted(() => {
	draw();
});
</script>

<style lang="scss" scoped>
.xubzgfgb {
	position: relative;
	width: 100%;
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;

	>canvas,
	>img,
	>picture {
		display: block;
		width: 100%;
		height: 100%;
	}

	>picture {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	>picture>img {
		max-width: 100%;
		max-height: 100%;
		width: auto;
		height: auto;
		object-fit: contain;
	}

	>canvas {
		position: absolute;
		object-fit: cover;
	}

	&.cover {
		>picture>img {
			width: 100%;
			height: 100%;
			max-width: none;
			max-height: none;
			object-fit: cover;
		}
	}
}
</style>
