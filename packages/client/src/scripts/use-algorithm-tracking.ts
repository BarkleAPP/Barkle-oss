import { onUnmounted, ref } from 'vue';
import type * as misskey from 'calckey-js';
import { algorithmTracker } from '@/services/algorithm-tracker';

export function useAlgorithmTracking(note: misskey.entities.Note) {
	const isVisible = ref(false);
	const observer = ref<IntersectionObserver | null>(null);
	const element = ref<HTMLElement | null>(null);
	let viewStartTime = 0;

	const setupTracking = (el: HTMLElement) => {
		element.value = el;

		// Set up intersection observer to track when note becomes visible
		observer.value = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						// Note became visible
						if (!isVisible.value) {
							isVisible.value = true;
							viewStartTime = Date.now();
							algorithmTracker.trackView(note.id);
						}
					} else {
						// Note is no longer visible
						if (isVisible.value) {
							isVisible.value = false;
							const dwellTime = Date.now() - viewStartTime;
							
							// Track dwell time if user viewed for more than 1 second
							if (dwellTime > 1000) {
								algorithmTracker.trackDwell(note.id);
							} else if (dwellTime < 500) {
								// Track as skip if viewed for less than 500ms
								algorithmTracker.trackSkip(note.id);
							}
						}
					}
				});
			},
			{
				threshold: 0.5, // Trigger when 50% of the note is visible
				rootMargin: '0px 0px -10% 0px', // Trigger slightly before leaving viewport
			}
		);

		observer.value.observe(el);
	};

	const trackReaction = (reactionType: string) => {
		algorithmTracker.trackReaction(note.id, reactionType);
	};

	const trackShare = () => {
		algorithmTracker.trackShare(note.id);
	};

	const trackComment = () => {
		algorithmTracker.trackComment(note.id);
	};

	const trackBlock = () => {
		algorithmTracker.trackBlock(note.id);
	};

	onUnmounted(() => {
		if (observer.value) {
			observer.value.disconnect();
		}
		
		// Track final dwell time if note was visible when component unmounts
		if (isVisible.value && viewStartTime > 0) {
			const dwellTime = Date.now() - viewStartTime;
			if (dwellTime > 1000) {
				algorithmTracker.trackDwell(note.id);
			}
		}
	});

	return {
		setupTracking,
		trackReaction,
		trackShare,
		trackComment,
		trackBlock,
		isVisible,
	};
}