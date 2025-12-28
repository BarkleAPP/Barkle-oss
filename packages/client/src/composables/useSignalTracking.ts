import { ref, onMounted, onUnmounted } from 'vue';
import { signalTracker } from '@/services/SignalTracker';

/**
 * Vue composable for tracking user interaction signals
 */
export function useSignalTracking() {
	const isTracking = ref(false);

	/**
	 * Track note view with intersection observer
	 */
	function trackNoteView(element: HTMLElement, noteId: string, position?: number) {
		if (!element || !noteId) return;

		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						signalTracker.trackView(noteId, position);
					} else {
						signalTracker.trackViewEnd(noteId);
					}
				});
			},
			{
				threshold: 0.5, // Track when 50% of the note is visible
				rootMargin: '0px'
			}
		);

		observer.observe(element);

		// Return cleanup function
		return () => {
			observer.unobserve(element);
			observer.disconnect();
		};
	}

	/**
	 * Track reaction with automatic sentiment analysis
	 */
	function trackReaction(noteId: string, reactionEmoji: string) {
		signalTracker.trackReaction(noteId, reactionEmoji);
	}

	/**
	 * Track reply action
	 */
	function trackReply(noteId: string) {
		signalTracker.trackReply(noteId);
	}

	/**
	 * Track renote action
	 */
	function trackRenote(noteId: string) {
		signalTracker.trackRenote(noteId);
	}

	/**
	 * Track profile click
	 */
	function trackProfileClick(userId: string) {
		signalTracker.trackProfileClick(userId);
	}

	/**
	 * Track follow action
	 */
	function trackFollow(userId: string) {
		signalTracker.trackFollow(userId);
	}

	/**
	 * Track unfollow action
	 */
	function trackUnfollow(userId: string) {
		signalTracker.trackUnfollow(userId);
	}

	/**
	 * Track link click
	 */
	function trackLinkClick(noteId: string, url: string) {
		signalTracker.trackLinkClick(noteId, url);
	}

	/**
	 * Track scroll past (negative signal)
	 */
	function trackScrollPast(noteId: string) {
		signalTracker.trackScrollPast(noteId);
	}

	/**
	 * Setup automatic scroll tracking for timeline
	 */
	function setupScrollTracking(containerElement: HTMLElement) {
		if (!containerElement) return;

		let lastScrollTime = Date.now();
		const scrolledPastNotes = new Set<string>();

		const handleScroll = () => {
			const now = Date.now();
			const timeSinceLastScroll = now - lastScrollTime;
			lastScrollTime = now;

			// If scrolling fast (less than 500ms between scroll events), 
			// consider notes as "scrolled past"
			if (timeSinceLastScroll < 500) {
				const noteElements = containerElement.querySelectorAll('[data-note-id]');
				noteElements.forEach((element) => {
					const noteId = element.getAttribute('data-note-id');
					if (noteId && !scrolledPastNotes.has(noteId)) {
						const rect = element.getBoundingClientRect();
						// If note is above viewport (scrolled past)
						if (rect.bottom < 0) {
							scrolledPastNotes.add(noteId);
							signalTracker.trackScrollPast(noteId);
						}
					}
				});
			}
		};

		containerElement.addEventListener('scroll', handleScroll, { passive: true });

		// Return cleanup function
		return () => {
			containerElement.removeEventListener('scroll', handleScroll);
		};
	}

	onMounted(() => {
		isTracking.value = true;
	});

	onUnmounted(() => {
		isTracking.value = false;
		// Flush any remaining signals
		signalTracker.flush();
	});

	return {
		isTracking,
		trackNoteView,
		trackReaction,
		trackReply,
		trackRenote,
		trackProfileClick,
		trackFollow,
		trackUnfollow,
		trackLinkClick,
		trackScrollPast,
		setupScrollTracking
	};
}