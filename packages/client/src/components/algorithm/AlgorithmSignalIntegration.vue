<template>
	<!-- This component automatically integrates algorithm signals into any page -->
	<div style="display: none;">
		<!-- Hidden component that handles signal collection -->
	</div>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { algorithmSignalService } from '@/services/AlgorithmSignalService';

// Props for configuration
interface Props {
	enabled?: boolean;
	source?: 'timeline' | 'search' | 'notification' | 'profile' | 'direct';
	timelineType?: string;
}

const props = withDefaults(defineProps<Props>(), {
	enabled: true,
	source: 'timeline',
	timelineType: 'hybrid'
});

// Track page view
onMounted(() => {
	if (props.enabled) {
		// Track timeline view
		algorithmSignalService.trackTimelineView(props.timelineType, {
			source: props.source,
			pageLoad: true
		});

		// Setup intersection observer for note visibility tracking
		setupNoteVisibilityTracking();
		
		// Setup scroll tracking
		setupScrollTracking();
	}
});

/**
 * Setup note visibility tracking using Intersection Observer
 */
function setupNoteVisibilityTracking() {
	const observer = new IntersectionObserver((entries) => {
		entries.forEach(entry => {
			const noteElement = entry.target as HTMLElement;
			const noteId = noteElement.dataset.noteId;
			
			if (!noteId) return;
			
			if (entry.isIntersecting) {
				// Note became visible - start tracking view
				algorithmSignalService.trackNoteView(noteId, {
					source: props.source,
					timelinePosition: parseInt(noteElement.dataset.position || '0'),
					visibilityRatio: entry.intersectionRatio
				});
			} else {
				// Note left viewport - end tracking
				algorithmSignalService.trackNoteViewEnd(noteId, {
					source: props.source,
					visibilityRatio: entry.intersectionRatio
				});
			}
		});
	}, {
		threshold: [0.1, 0.5, 0.9], // Track different visibility levels
		rootMargin: '0px 0px -10% 0px' // Only count as visible when 10% from bottom
	});

	// Observe all note elements
	const observeNotes = () => {
		const noteElements = document.querySelectorAll('[data-note-id]');
		noteElements.forEach(element => observer.observe(element));
	};

	// Initial observation
	observeNotes();

	// Re-observe when new notes are added (for infinite scroll)
	const mutationObserver = new MutationObserver(() => {
		observeNotes();
	});

	mutationObserver.observe(document.body, {
		childList: true,
		subtree: true
	});

	// Cleanup on unmount
	onUnmounted(() => {
		observer.disconnect();
		mutationObserver.disconnect();
	});
}

/**
 * Setup scroll tracking for timeline
 */
function setupScrollTracking() {
	let scrollTimeout: number;
	let lastScrollDepth = 0;

	const handleScroll = () => {
		clearTimeout(scrollTimeout);
		
		scrollTimeout = window.setTimeout(() => {
			const scrollDepth = window.scrollY / (document.body.scrollHeight - window.innerHeight);
			
			// Only track significant scroll changes
			if (Math.abs(scrollDepth - lastScrollDepth) > 0.1) {
				const visibleNotes = getVisibleNoteIds();
				
				algorithmSignalService.trackTimelineScroll(visibleNotes, scrollDepth, {
					source: props.source,
					scrollDirection: scrollDepth > lastScrollDepth ? 'down' : 'up'
				});
				
				lastScrollDepth = scrollDepth;
			}
		}, 500); // Debounce scroll events
	};

	window.addEventListener('scroll', handleScroll, { passive: true });

	onUnmounted(() => {
		window.removeEventListener('scroll', handleScroll);
		clearTimeout(scrollTimeout);
	});
}

/**
 * Get currently visible note IDs
 */
function getVisibleNoteIds(): string[] {
	const noteElements = document.querySelectorAll('[data-note-id]');
	const visibleNotes: string[] = [];
	
	noteElements.forEach(element => {
		const rect = element.getBoundingClientRect();
		const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
		
		if (isVisible) {
			const noteId = (element as HTMLElement).dataset.noteId;
			if (noteId) visibleNotes.push(noteId);
		}
	});
	
	return visibleNotes;
}

// Expose methods for manual signal collection
defineExpose({
	trackReaction: (noteId: string, reactionType: string) => {
		algorithmSignalService.trackReaction(noteId, reactionType, {
			source: props.source
		});
	},
	trackSearch: (query: string, results: string[], clickedId?: string) => {
		algorithmSignalService.trackSearch(query, results, clickedId, {
			source: props.source
		});
	},
	trackFollow: (userId: string, action: 'follow' | 'unfollow') => {
		algorithmSignalService.trackFollowAction(userId, action, {
			source: props.source
		});
	}
});
</script>