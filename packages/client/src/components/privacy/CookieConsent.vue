<template>
	<div v-if="showBanner" class="cookie-consent-banner">
		<div class="cookie-consent-content">
			<div class="cookie-consent-text">
				<h3>Cookie Preferences</h3>
				<p>We use cookies to enhance your experience. You can customize your preferences below.</p>
				<a href="https://avunite.com/barkle-privacy" target="_blank" class="privacy-link">
					View Privacy Policy
				</a>
			</div>
			<div class="cookie-consent-actions">
				<MkButton @click="showSettings = true" class="settings-btn">
					Customize
				</MkButton>
				<MkButton @click="rejectAll" class="reject-btn">
					Reject All
				</MkButton>
				<MkButton @click="acceptAll" primary class="accept-btn">
					Accept All
				</MkButton>
			</div>
		</div>
		
		<div v-if="showSettings" class="cookie-settings-modal" @click.self="showSettings = false">
			<div class="cookie-settings-content">
				<div class="cookie-settings-header">
					<h3>Cookie Settings</h3>
					<button @click="showSettings = false" class="close-btn">
						<i class="ph-x-bold ph-lg"></i>
					</button>
				</div>
				
				<div class="cookie-categories">
					<div class="cookie-category">
						<div class="category-header">
							<h4>Essential Cookies</h4>
							<FormSwitch v-model="essentialCookies" disabled />
						</div>
						<p class="category-description">
							Required for basic site functionality, authentication, and security. Cannot be disabled.
						</p>
					</div>
					
					<div class="cookie-category">
						<div class="category-header">
							<h4>Analytics Cookies</h4>
							<FormSwitch v-model="analyticsCookies" @update:modelValue="updateConsent" />
						</div>
						<p class="category-description">
							Help us understand how you use our site to improve performance and user experience.
						</p>
					</div>
					
					<div class="cookie-category">
						<div class="category-header">
							<h4>Functional Cookies</h4>
							<FormSwitch v-model="functionalCookies" @update:modelValue="updateConsent" />
						</div>
						<p class="category-description">
							Enable enhanced features like remembering your preferences and settings.
						</p>
					</div>
				</div>
				
				<div class="cookie-settings-actions">
					<MkButton @click="acceptSelected">
						Accept Selected
					</MkButton>
					<MkButton @click="rejectAll">
						Reject All
					</MkButton>
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import MkButton from '@/components/MkButton.vue';
import FormSwitch from '@/components/form/switch.vue';
import { i18n } from '@/i18n';

const showBanner = ref(false);
const showSettings = ref(false);
const essentialCookies = ref(true);
const analyticsCookies = ref(false);
const functionalCookies = ref(false);

const CONSENT_KEY = 'barkle-cookie-consent';
const CONSENT_VERSION = '1.0';

interface CookieConsent {
	version: string;
	timestamp: number;
	essential: boolean;
	analytics: boolean;
	functional: boolean;
}

onMounted(() => {
	checkConsentStatus();
});

function checkConsentStatus() {
	const stored = localStorage.getItem(CONSENT_KEY);
	if (!stored) {
		showBanner.value = true;
		return;
	}
	
	try {
		const consent: CookieConsent = JSON.parse(stored);
		if (consent.version !== CONSENT_VERSION) {
			showBanner.value = true;
			return;
		}
		
		// Apply stored preferences
		analyticsCookies.value = consent.analytics;
		functionalCookies.value = consent.functional;
		
		// Initialize tracking based on consent
		initializeTracking(consent);
	} catch {
		showBanner.value = true;
	}
}

function saveConsent() {
	const consent: CookieConsent = {
		version: CONSENT_VERSION,
		timestamp: Date.now(),
		essential: true,
		analytics: analyticsCookies.value,
		functional: functionalCookies.value,
	};
	
	localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
	initializeTracking(consent);
}

function acceptAll() {
	analyticsCookies.value = true;
	functionalCookies.value = true;
	saveConsent();
	showBanner.value = false;
	showSettings.value = false;
}

function acceptSelected() {
	saveConsent();
	showBanner.value = false;
	showSettings.value = false;
}

function rejectAll() {
	analyticsCookies.value = false;
	functionalCookies.value = false;
	saveConsent();
	showBanner.value = false;
	showSettings.value = false;
}

function updateConsent() {
	if (!showBanner.value) {
		saveConsent();
	}
}

function initializeTracking(consent: CookieConsent) {
	// Initialize analytics if consented
	if (consent.analytics) {
		console.log('Analytics tracking enabled');
		// Add your analytics initialization here
	} else {
		console.log('Analytics tracking disabled');
		// Disable analytics tracking
	}
	
	// Initialize functional cookies if consented
	if (consent.functional) {
		console.log('Functional cookies enabled');
		// Add functional cookie initialization here
	} else {
		console.log('Functional cookies disabled');
		// Disable functional cookies
	}
}

// Expose consent status for other components
defineExpose({
	hasConsent: (category: string) => {
		const stored = localStorage.getItem(CONSENT_KEY);
		if (!stored) return false;
		
		try {
			const consent: CookieConsent = JSON.parse(stored);
			return consent[category as keyof CookieConsent] === true;
		} catch {
			return false;
		}
	},
	updateConsent: (category: string, value: boolean) => {
		if (category === 'analytics') analyticsCookies.value = value;
		if (category === 'functional') functionalCookies.value = value;
		updateConsent();
	},
	showSettings: () => {
		showSettings.value = true;
	}
});
</script>

<style lang="scss" scoped>
.cookie-consent-banner {
	position: fixed;
	bottom: 0;
	left: 0;
	right: 0;
	background: var(--panel);
	border-top: 1px solid var(--divider);
	box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.1);
	z-index: 10000;
	padding: 20px;
}

.cookie-consent-content {
	max-width: 1200px;
	margin: 0 auto;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 20px;
	
	@media (max-width: 768px) {
		flex-direction: column;
		align-items: stretch;
		text-align: center;
	}
}

.cookie-consent-text {
	flex: 1;
	
	h3 {
		margin: 0 0 8px 0;
		font-size: 1.1em;
		font-weight: 600;
	}
	
	p {
		margin: 0 0 8px 0;
		opacity: 0.8;
		line-height: 1.4;
	}
	
	.privacy-link {
		color: var(--accent);
		text-decoration: none;
		font-size: 0.9em;
		
		&:hover {
			text-decoration: underline;
		}
	}
}

.cookie-consent-actions {
	display: flex;
	gap: 12px;
	
	@media (max-width: 768px) {
		justify-content: center;
		margin-top: 16px;
		flex-wrap: wrap;
	}
}

.cookie-settings-modal {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background: rgba(0, 0, 0, 0.5);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 10001;
	padding: 20px;
}

.cookie-settings-content {
	background: var(--panel);
	border-radius: 12px;
	max-width: 600px;
	width: 100%;
	max-height: 80vh;
	overflow-y: auto;
	padding: 24px;
}

.cookie-settings-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 24px;
	
	h3 {
		margin: 0;
		font-size: 1.3em;
		font-weight: 600;
	}
	
	.close-btn {
		background: none;
		border: none;
		color: var(--text);
		cursor: pointer;
		padding: 8px;
		border-radius: 6px;
		
		&:hover {
			background: var(--buttonHoverBg);
		}
	}
}

.cookie-categories {
	margin-bottom: 24px;
}

.cookie-category {
	margin-bottom: 24px;
	padding: 16px;
	background: var(--bg);
	border-radius: 8px;
	
	&:last-child {
		margin-bottom: 0;
	}
}

.category-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 8px;
	
	h4 {
		margin: 0;
		font-size: 1em;
		font-weight: 600;
	}
}

.category-description {
	margin: 0;
	opacity: 0.7;
	line-height: 1.4;
	font-size: 0.9em;
}

.cookie-settings-actions {
	display: flex;
	gap: 12px;
	justify-content: flex-end;
	
	@media (max-width: 480px) {
		flex-direction: column;
	}
}
</style>