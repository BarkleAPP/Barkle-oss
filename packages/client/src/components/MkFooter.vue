<template>
	<footer class="mk-footer">
		<div class="footer-content">
			<div class="footer-links">
				<a href="https://avunite.com/barkle-privacy" target="_blank" class="footer-link">
					Privacy Policy
				</a>
				<RouterLink to="/settings/privacy-compliance" class="footer-link">
					Privacy & Data Protection
				</RouterLink>
				<a href="mailto:support@avunite.com" class="footer-link">
					{{ i18n.ts.contact }}
				</a>
			</div>
			<div class="footer-info">
				<p>&copy; {{ currentYear }} Barkle. Your privacy matters to us.</p>
			</div>
		</div>
	</footer>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { i18n } from '@/i18n';

const currentYear = computed(() => new Date().getFullYear());
</script>

<style lang="scss" scoped>
.mk-footer {
	background: var(--panel);
	border-top: 1px solid var(--divider);
	padding: 24px 20px;
	margin-top: auto;
}

.footer-content {
	max-width: 1200px;
	margin: 0 auto;
	text-align: center;
}

.footer-links {
	display: flex;
	justify-content: center;
	gap: 24px;
	margin-bottom: 16px;
	flex-wrap: wrap;
	
	@media (max-width: 480px) {
		flex-direction: column;
		gap: 12px;
	}
}

.footer-link {
	color: var(--text);
	text-decoration: none;
	font-size: 0.9em;
	opacity: 0.8;
	transition: opacity 0.2s;
	
	&:hover {
		opacity: 1;
		text-decoration: underline;
	}
}

.footer-info {
	p {
		margin: 0;
		font-size: 0.8em;
		opacity: 0.6;
		line-height: 1.4;
	}
}
</style>