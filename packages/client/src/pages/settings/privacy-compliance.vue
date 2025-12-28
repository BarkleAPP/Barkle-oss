<template>
<div class="_formRoot">
	<div class="_section">
		<div class="_title">Privacy & Data Protection</div>
		<div class="_content">
			<p>Manage your privacy settings and exercise your data protection rights under GDPR and other privacy laws.</p>
			
			<div class="privacy-links">
				<a href="https://avunite.com/barkle-privacy" target="_blank" class="privacy-link">
					<i class="ph-shield-check-bold ph-lg"></i>
					Privacy Policy
				</a>
			</div>
		</div>
	</div>

	<div class="_section">
		<div class="_title">Cookie Preferences</div>
		<div class="_content">
			<p>Control how cookies are used on this site. Essential cookies are always enabled.</p>
			
			<div class="cookie-controls">
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
						<FormSwitch v-model="analyticsCookies" @update:modelValue="updateCookieConsent" />
					</div>
					<p class="category-description">
						Help us understand how you use our site to improve performance and user experience.
					</p>
				</div>
				
				<div class="cookie-category">
					<div class="category-header">
						<h4>Functional Cookies</h4>
						<FormSwitch v-model="functionalCookies" @update:modelValue="updateCookieConsent" />
					</div>
					<p class="category-description">
						Enable enhanced features like remembering your preferences and settings.
					</p>
				</div>
			</div>
		</div>
	</div>

	<div class="_section">
		<div class="_title">Your Data Rights</div>
		<div class="_content">
			<p>You have the right to access, correct, or delete your personal data. Use the options below to exercise these rights.</p>
			
			<div class="data-rights-actions">
				<MkButton @click="exportData" class="data-action">
					<i class="ph-download-bold ph-lg"></i>
					Export My Data
				</MkButton>
				
				<MkButton @click="showDataCorrection = true" class="data-action">
					<i class="ph-pencil-bold ph-lg"></i>
					Correct My Data
				</MkButton>
				
				<MkButton @click="showDataDeletion = true" danger class="data-action">
					<i class="ph-trash-bold ph-lg"></i>
					Delete My Data
				</MkButton>
			</div>
		</div>
	</div>

	<div class="_section">
		<div class="_title">Data Protection Contact</div>
		<div class="_content">
			<p>If you have questions about how your data is processed or need assistance with your privacy rights:</p>
			<div class="contact-info">
				<p><strong>Data Protection Officer</strong></p>
				<p>Email: support@avunite.com</p>
				<p>We aim to respond within 30 days as required by law.</p>
			</div>
		</div>
	</div>

	<!-- Data Correction Modal -->
	<MkModal v-if="showDataCorrection" @click="showDataCorrection = false" @esc="showDataCorrection = false">
		<div class="data-modal">
			<div class="modal-header">
				<h3>Correct My Data</h3>
				<button @click="showDataCorrection = false" class="close-btn">
					<i class="ph-x-bold ph-lg"></i>
				</button>
			</div>
			<div class="modal-content">
				<p>You can update most of your information directly in your profile settings. For other data corrections, please contact our support team.</p>
				<div class="correction-links">
					<MkButton @click="goToProfile" primary>
						Update Profile
					</MkButton>
					<MkButton @click="contactSupport">
						Contact Support
					</MkButton>
				</div>
			</div>
		</div>
	</MkModal>

	<!-- Data Deletion Confirmation Modal -->
	<MkModal v-if="showDataDeletion" @click="showDataDeletion = false" @esc="showDataDeletion = false">
		<div class="data-modal">
			<div class="modal-header">
				<h3>Delete My Data</h3>
				<button @click="showDataDeletion = false" class="close-btn">
					<i class="ph-x-bold ph-lg"></i>
				</button>
			</div>
			<div class="modal-content">
				<p>This will permanently delete your account and all associated data. This action cannot be undone.</p>
				<div class="deletion-actions">
					<MkButton @click="goToDeleteAccount" danger>
						Proceed to Account Deletion
					</MkButton>
					<MkButton @click="showDataDeletion = false">
						{{ i18n.ts.cancel }}
					</MkButton>
				</div>
			</div>
		</div>
	</MkModal>
</div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import MkButton from '@/components/MkButton.vue';
import MkModal from '@/components/MkModal.vue';
import FormSwitch from '@/components/form/switch.vue';
import { i18n } from '@/i18n';
import { definePageMetadata } from '@/scripts/page-metadata';
import * as os from '@/os';

const showDataCorrection = ref(false);
const showDataDeletion = ref(false);
const essentialCookies = ref(true);
const analyticsCookies = ref(false);
const functionalCookies = ref(false);

const CONSENT_KEY = 'barkle-cookie-consent';

onMounted(() => {
	loadCookiePreferences();
});

function loadCookiePreferences() {
	const stored = localStorage.getItem(CONSENT_KEY);
	if (stored) {
		try {
			const consent = JSON.parse(stored);
			analyticsCookies.value = consent.analytics || false;
			functionalCookies.value = consent.functional || false;
		} catch {
			// Ignore parsing errors
		}
	}
}

function updateCookieConsent() {
	const consent = {
		version: '1.0',
		timestamp: Date.now(),
		essential: true,
		analytics: analyticsCookies.value,
		functional: functionalCookies.value,
	};
	
	localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
	
	os.alert({
		type: 'success',
		text: 'Cookie preferences updated successfully'
	});
}

async function exportData() {
	const { canceled } = await os.confirm({
		type: 'info',
		text: 'This will create a complete export of your data. You\'ll receive an email when it\'s ready.',
	});
	
	if (canceled) return;
	
	try {
		await os.api('i/export-user-data', {
			includePrivateData: true,
			format: 'json'
		});
		
		os.alert({
			type: 'success',
			text: 'Export requested successfully'
		});
	} catch (error) {
		os.alert({
			type: 'error',
			text: (error as any).message || 'Export failed',
		});
	}
}

function goToProfile() {
	showDataCorrection.value = false;
	location.href = '/settings/profile';
}

function goToDeleteAccount() {
	showDataDeletion.value = false;
	location.href = '/settings/delete-account';
}

async function contactSupport() {
	showDataCorrection.value = false;
	
	const formResult = await os.form('Data Correction Request', {
		dataType: {
			type: 'radio',
			label: 'Data Type',
			options: [
				{ value: 'profile', label: 'Profile Information' },
				{ value: 'posts', label: 'Posts/Notes' },
				{ value: 'other', label: 'Other Data' },
			],
		},
		description: {
			type: 'textarea',
			label: 'Description',
			placeholder: 'Please describe what data needs to be corrected...',
		},
		currentValue: {
			type: 'string',
			label: 'Current Value (optional)',
			placeholder: 'What is currently incorrect?',
		},
		requestedValue: {
			type: 'string',
			label: 'Requested Value (optional)',
			placeholder: 'What should it be?',
		},
	});
	
	if (formResult.canceled) return;
	
	try {
		await os.api('i/request-data-correction', formResult.result);
		os.alert({
			type: 'success',
			text: 'Data correction request submitted successfully. We will review it within 30 days.'
		});
	} catch (error) {
		os.alert({
			type: 'error',
			text: (error as any).message || 'Failed to submit data correction request',
		});
	}
}

definePageMetadata({
	title: 'Privacy & Data Protection',
	icon: 'ph-shield-check-bold ph-lg',
});
</script>

<style lang="scss" scoped>
.privacy-links {
	margin: 16px 0;
}

.privacy-link {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	color: var(--accent);
	text-decoration: none;
	padding: 12px 16px;
	background: var(--bg);
	border-radius: 8px;
	transition: background 0.2s;
	
	&:hover {
		background: var(--buttonHoverBg);
		text-decoration: none;
	}
}

.cookie-controls {
	margin-top: 16px;
}

.cookie-category {
	margin-bottom: 20px;
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

.data-rights-actions {
	display: flex;
	flex-wrap: wrap;
	gap: 12px;
	margin-top: 16px;
}

.data-action {
	display: flex;
	align-items: center;
	gap: 8px;
}

.contact-info {
	margin-top: 16px;
	padding: 16px;
	background: var(--bg);
	border-radius: 8px;
	
	p {
		margin: 4px 0;
		
		&:first-child {
			margin-top: 0;
		}
		
		&:last-child {
			margin-bottom: 0;
		}
	}
}

.data-modal {
	background: var(--panel);
	border-radius: 12px;
	max-width: 500px;
	width: 90vw;
	padding: 24px;
}

.modal-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 20px;
	
	h3 {
		margin: 0;
		font-size: 1.2em;
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

.modal-content {
	p {
		margin: 0 0 20px 0;
		line-height: 1.6;
	}
}

.correction-links,
.deletion-actions {
	display: flex;
	gap: 12px;
	justify-content: flex-end;
	
	@media (max-width: 480px) {
		flex-direction: column;
	}
}
</style>