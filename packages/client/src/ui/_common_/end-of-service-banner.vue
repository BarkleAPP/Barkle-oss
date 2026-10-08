<template>
<div v-if="instance.endOfServiceMode" class="eos-banner">
	<div class="eos-banner-content">
		<i class="ph-warning-bold ph-lg eos-icon"></i>
		<div class="eos-text">
			<span class="eos-title">{{ i18n.ts._diversity.endOfServiceBannerTitle }}</span>
			<span class="eos-desc">{{ instance.endOfServiceMessage || i18n.ts._diversity.endOfServiceBannerText }}</span>
		</div>
		<div class="eos-actions">
			<MkA v-if="$i" to="/settings/import-export" behavior="browser" class="eos-action-btn">
				<i class="ph-download-bold ph-sm"></i> {{ i18n.ts._diversity.endOfServiceDownloadData }}
			</MkA>
			<MkA v-if="$i" to="/settings/delete-account" behavior="browser" class="eos-action-btn eos-action-btn--danger">
				<i class="ph-trash-bold ph-sm"></i> {{ i18n.ts._diversity.endOfServiceDeleteAccount }}
			</MkA>
		</div>
	</div>
</div>
</template>

<script lang="ts" setup>
import { instance } from '@/instance';
import { i18n } from '@/i18n';
import { $i } from '@/account';
</script>

<style lang="scss" scoped>
.eos-banner {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	width: 100%;
	z-index: 10000;
	background: linear-gradient(135deg, #c0392b, #922b21);
	color: #fff;
	padding: 10px 16px;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
	box-sizing: border-box;

	.eos-banner-content {
		display: flex;
		align-items: center;
		gap: 12px;
		max-width: 1200px;
		margin: 0 auto;
		flex-wrap: wrap;
	}

	.eos-icon {
		flex-shrink: 0;
		font-size: 1.4em;
		opacity: 0.9;
	}

	.eos-text {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.eos-title {
		font-weight: 700;
		font-size: 0.95em;
	}

	.eos-desc {
		font-size: 0.85em;
		opacity: 0.9;
		word-break: break-word;
	}

	.eos-actions {
		display: flex;
		gap: 8px;
		flex-shrink: 0;
		flex-wrap: wrap;
	}

	.eos-action-btn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 5px 12px;
		border-radius: 20px;
		font-size: 0.82em;
		font-weight: 600;
		background: rgba(255, 255, 255, 0.2);
		color: #fff;
		text-decoration: none;
		transition: background 0.15s;
		white-space: nowrap;

		&:hover {
			background: rgba(255, 255, 255, 0.35);
		}

		&--danger {
			background: rgba(0, 0, 0, 0.25);

			&:hover {
				background: rgba(0, 0, 0, 0.4);
			}
		}
	}

	@media (max-width: 768px) {
		padding: 10px 12px;

		.eos-banner-content {
			flex-direction: column;
			align-items: center;
			text-align: center;
		}

		.eos-text {
			width: 100%;
			align-items: center;
		}

		.eos-actions {
			justify-content: center;
		}
	}
}
</style>
