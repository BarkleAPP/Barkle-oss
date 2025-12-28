<template>
	<div v-if="showFeedback" class="diversity-feedback">
		<div class="diversity-indicator">
			<i class="ti ti-sparkles"></i>
			<span class="diversity-label">{{ $ts._diversity.diverseContent }}</span>
		</div>
		
		<div class="feedback-buttons">
			<button
				class="feedback-btn positive"
				:class="{ active: feedback === 'positive' }"
				@click="provideFeedback('positive')"
				:title="$ts._diversity.diversityFeedbackPositive"
			>
				<i class="ti ti-thumb-up"></i>
			</button>
			
			<button
				class="feedback-btn neutral"
				:class="{ active: feedback === 'neutral' }"
				@click="provideFeedback('neutral')"
				:title="$ts._diversity.diversityFeedbackNeutral"
			>
				<i class="ti ti-minus"></i>
			</button>
			
			<button
				class="feedback-btn negative"
				:class="{ active: feedback === 'negative' }"
				@click="provideFeedback('negative')"
				:title="$ts._diversity.diversityFeedbackNegative"
			>
				<i class="ti ti-thumb-down"></i>
			</button>
		</div>
		
		<div v-if="feedbackProvided" class="feedback-thanks">
			{{ $ts._diversity.diversityFeedbackThanks }}
		</div>
	</div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { diversityService } from '@/services/DiversityService';

interface Props {
	contentId: string;
	content?: any;
	showAlways?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
	showAlways: false,
});

const feedback = ref<'positive' | 'negative' | 'neutral' | null>(null);
const feedbackProvided = ref(false);
const isSubmitting = ref(false);

// Show feedback UI if content is exploration content or showAlways is true
const showFeedback = computed(() => {
	if (props.showAlways) return true;
	if (!props.content) return false;
	return diversityService.isExplorationContent(props.content);
});

const provideFeedback = async (feedbackType: 'positive' | 'negative' | 'neutral') => {
	if (isSubmitting.value || feedback.value === feedbackType) return;

	isSubmitting.value = true;
	feedback.value = feedbackType;

	try {
		const success = await diversityService.provideDiversityFeedback(
			props.contentId,
			feedbackType
		);

		if (success) {
			feedbackProvided.value = true;
			
			// Hide feedback thanks after 3 seconds
			setTimeout(() => {
				feedbackProvided.value = false;
			}, 3000);
		} else {
			// Reset on failure
			feedback.value = null;
		}
	} catch (error) {
		console.error('Error providing diversity feedback:', error);
		feedback.value = null;
	} finally {
		isSubmitting.value = false;
	}
};

// Track when this exploration content is viewed
onMounted(() => {
	if (showFeedback.value) {
		diversityService.trackExplorationInteraction(props.contentId, 'view');
	}
});
</script>

<style lang="scss" scoped>
.diversity-feedback {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 8px 12px;
	background: var(--panel);
	border: 1px solid var(--divider);
	border-radius: 8px;
	margin-top: 8px;
	font-size: 0.85em;
}

.diversity-indicator {
	display: flex;
	align-items: center;
	gap: 4px;
	color: var(--accent);
	font-weight: 500;

	i {
		font-size: 1.1em;
	}
}

.diversity-label {
	font-size: 0.9em;
}

.feedback-buttons {
	display: flex;
	gap: 4px;
	margin-left: auto;
}

.feedback-btn {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 28px;
	height: 28px;
	border: 1px solid var(--divider);
	border-radius: 6px;
	background: var(--buttonBg);
	color: var(--fg);
	cursor: pointer;
	transition: all 0.2s ease;

	&:hover {
		background: var(--buttonHoverBg);
		border-color: var(--accent);
	}

	&.active {
		border-color: var(--accent);
		background: var(--accent);
		color: var(--accentFg);
	}

	&.positive.active {
		background: var(--success);
		border-color: var(--success);
	}

	&.negative.active {
		background: var(--error);
		border-color: var(--error);
	}

	&.neutral.active {
		background: var(--warn);
		border-color: var(--warn);
	}

	i {
		font-size: 0.9em;
	}
}

.feedback-thanks {
	color: var(--success);
	font-size: 0.85em;
	font-weight: 500;
	margin-left: 8px;
	animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
	from {
		opacity: 0;
		transform: translateY(-4px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

// Responsive design
@media (max-width: 500px) {
	.diversity-feedback {
		flex-direction: column;
		align-items: flex-start;
		gap: 8px;
	}

	.feedback-buttons {
		margin-left: 0;
		align-self: flex-end;
	}
}
</style>