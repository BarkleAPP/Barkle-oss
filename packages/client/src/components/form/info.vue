<template>
<div class="info">
	<div class="text">
		<slot></slot>
	</div>
</div>
</template>

<script lang="ts" setup>
</script>

<style lang="scss" scoped>
.info {
	padding: 16px;
	background: var(--infoBg);
	color: var(--infoFg);
	border-radius: 6px;
	border: solid 1px var(--divider);

	> .text {
		font-size: 0.9em;
		line-height: 1.4;
	}
}
</style>
