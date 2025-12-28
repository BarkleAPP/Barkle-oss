<template>
	<div class="landing-page">
		<!-- Original background image -->
		<div class="original-background">
			<MkFeaturedPhotos class="featured-photos" />
		</div>

		<!-- Featured Photos background -->


		<!-- barkle-style diagonal scrolling background -->
		<div class="barkle-background">
			<div class="scrolling-container" ref="scrollingContainer">
				<div class="notes-grid">
					<div v-for="note in flatNotes" :key="note.id" class="note-item">
						<MkNote v-if="note.loaded && note.user" :note="note" class="background-note" />
						<div v-else class="note-skeleton"></div>
					</div>
				</div>
			</div>

			<!-- Gradient overlays for barkle effect -->
			<div class="gradient-overlay top"></div>
			<div class="gradient-overlay bottom"></div>
			<div class="gradient-overlay left"></div>
			<div class="gradient-overlay right"></div>
			<div class="center-spotlight"></div>
		</div>

		<div class="content-wrapper">
			<header>
				<div class="logo">
					<img v-if="meta?.logoImageUrl" class="logo-image" :src="meta.logoImageUrl"
						:alt="meta.name + ' logo'">
					<span v-else class="logo-text">{{ meta?.name || 'BARKLE!' }}</span>
				</div>
				<h1>{{ meta?.name || 'BARKLE!' }}</h1>
				<div class="tagline-container">
					<transition name="fade" mode="out-in">
						<p :key="currentTaglineIndex" class="tagline">{{ currentTagline }}</p>
					</transition>
				</div>
			</header>

			<footer>
				<div class="auth-container">
					<!-- Pre-release messaging -->
					<div v-if="meta?.preReleaseMode" class="pre-release-notice">
						<div class="pre-release-content">
							<h3>#BackOnBarkle!</h3>
							<p>We're preparing something amazing for you. During this pre-release phase, access is
								limited to select users.</p>
						</div>
					</div>

					<div class="auth-buttons">
						<MkButton class="signin-button" rounded outlined @click="signin()">
							{{ i18n.ts.login }}
						</MkButton>
						<MkButton v-if="!meta?.preReleaseMode" class="signup-button" rounded gradate @click="signup()">
							{{ i18n.ts.signup }}
						</MkButton>
						<div v-else class="pre-release-signup-message">
							<p>Registration temporarily disabled!</p>
						</div>
						<MkButton class="explore-button" rounded outlined @click="explore()">
							{{ i18n.ts.explore }}
						</MkButton>
					</div>
					<div class="attribution">
						<small>
							Built with <a href="https://github.com/misskey-dev/misskey" target="_blank"
								rel="noopener">Misskey</a> •
							<a href="https://github.com/BarkleAPP/Barkle-oss" target="_blank" rel="noopener">Open
								Source</a>
						</small>
					</div>
				</div>
			</footer>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { ref, watch, computed, onMounted, onUnmounted, nextTick } from "vue";
import MkButton from "@/components/MkButton.vue";
import MkNote from "@/components/MkNote.vue";
import MkFeaturedPhotos from "@/components/MkFeaturedPhotos.vue";
import XSigninDialog from "@/components/MkSigninDialog.vue";
import XSignupDialog from '@/components/MkSignupDialog.vue';
import { i18n } from "@/i18n";
import * as os from "@/os";
import { miLocalStorage } from "@/local-storage";
import { useRouter } from "@/router";
import { langs as _langs } from "@/config";
import { deviceKind } from "@/scripts/device-kind";

const langs = ref(_langs);
const lang = ref(miLocalStorage.getItem("lang"));
const meta = ref(null);
const flatNotes = ref<NoteWithState[]>([]);
const scrollingContainer = ref(null);
const router = useRouter();

const taglines = computed(() => [
	i18n.ts.landingTagline1,
	i18n.ts.landingTagline2,
	i18n.ts.landingTagline3,
	i18n.ts.landingTagline4,
	i18n.ts.landingTagline5
]);

const currentTaglineIndex = ref(0);
const currentTagline = computed(() => taglines.value[currentTaglineIndex.value]);

let taglineInterval: number;
let animationFrameId: number | undefined;

// Performance optimization: Batch DOM updates
const batchSize = 5;
const totalNotesToShow = ref(0); // Will be calculated dynamically
const isMobile = computed(() => deviceKind === 'smartphone' || window.innerWidth <= 600);
const isLowMemory = computed(() => {
	// Detect low memory conditions
	if ('memory' in performance && 'deviceMemory' in navigator) {
		return (navigator as any).deviceMemory <= 4; // 4GB or less
	}
	// Fallback: assume mobile devices have lower memory
	return isMobile.value;
});

// Type for note with loading state
interface NoteWithState {
	id: string;
	loaded: boolean;
	placeholder?: boolean;
	[key: string]: any;
}

// Calculate how many notes we need to fill the screen
function calculateNotesNeeded() {
	const viewportHeight = window.innerHeight;
	const viewportWidth = window.innerWidth;

	// Mobile optimization: Significantly reduce notes for mobile devices
	if (isMobile.value || isLowMemory.value) {
		// For mobile, use a much smaller number of notes
		const mobileNoteHeight = 120;
		const mobileNoteWidth = 180;
		const mobileGap = 10;

		const mobileNotesPerRow = Math.floor(viewportWidth / (mobileNoteWidth + mobileGap));
		const mobileNotesPerColumn = Math.floor((viewportHeight * 1.5) / (mobileNoteHeight + mobileGap)); // Only 150% height instead of 300%

		const mobileTotal = Math.max(mobileNotesPerRow * mobileNotesPerColumn, 30); // Minimum 30, maximum around 60-80
		console.log(`Mobile mode: ${mobileTotal} notes calculated`);
		return Math.min(mobileTotal, 80); // Cap at 80 notes for mobile
	}

	// Desktop calculation (original logic)
	const noteHeight = 170;
	const noteWidth = 220;
	const gapBetweenNotes = 15;

	const notesPerRow = Math.floor((viewportWidth * 1.3) / (noteWidth + gapBetweenNotes));
	const notesPerColumn = Math.floor((viewportHeight * 3) / (noteHeight + gapBetweenNotes));

	const cornerFillFactor = 1.2;
	const totalNotes = Math.ceil(notesPerRow * notesPerColumn * cornerFillFactor);

	const minNotes = 250;
	return Math.max(totalNotes, minNotes);
}

// Function to shuffle an array (Fisher-Yates algorithm)
function shuffleArray<T>(array: T[]): T[] {
	// Create a copy of the array to avoid modifying the original
	const shuffled = [...array];

	// Start from the last element and swap with a random element before it
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}

	return shuffled;
}

async function fetchFeaturedNotes() {
	// Calculate how many notes we need for the current screen size
	totalNotesToShow.value = calculateNotesNeeded();
	console.log(`Calculated ${totalNotesToShow.value} notes needed for screen size ${window.innerWidth}x${window.innerHeight}`);

	try {
		// Mobile optimization: Fetch fewer notes from API for mobile devices
		const apiLimit = isMobile.value || isLowMemory.value ? 25 : 45;
		const notes = await os.api('notes/featured', { limit: apiLimit });
		console.log('Fetched notes:', notes);

		if (!notes || notes.length === 0) {
			console.log('No notes available, creating empty notes');
			createEmptyNotes();
			return;
		}

		const availableNotes = notes.filter(note => note && note.id);

		// Shuffle the notes for random display
		const shuffledNotes = shuffleArray(availableNotes);

		// Create enough notes by repeating the shuffled ones if needed
		const repeatedNotes: NoteWithState[] = [];
		for (let i = 0; i < totalNotesToShow.value; i++) {
			const noteIndex = i % shuffledNotes.length;
			const originalNote = shuffledNotes[noteIndex];
			// Create a unique copy with modified ID to avoid key conflicts
			repeatedNotes.push({
				...originalNote,
				id: `${originalNote.id}-${i}`, // Make ID unique
				loaded: false
			});
		}

		flatNotes.value = repeatedNotes;
		console.log('Created flatNotes:', flatNotes.value);

		// Progressively load notes for better performance
		await nextTick();
		loadNotesProgressively();

	} catch (error) {
		console.error('Failed to fetch featured notes:', error);
		// Fallback to empty notes for layout consistency
		createEmptyNotes();
	}
}

function createEmptyNotes() {
	const emptyNotes: NoteWithState[] = [];
	for (let i = 0; i < totalNotesToShow.value; i++) {
		emptyNotes.push({
			id: `empty-${i}`,
			loaded: false, // Will show skeleton
			text: null,
			user: null
		});
	}
	flatNotes.value = emptyNotes;
	console.log('Created empty notes for skeleton display');
}

async function loadNotesProgressively() {
	// Mobile optimization: Faster loading with fewer delays for mobile
	const loadDelay = isMobile.value || isLowMemory.value ? 25 : 50; // Faster loading on mobile
	const batchSize = isMobile.value || isLowMemory.value ? 10 : 5; // Load more notes at once on mobile

	// Load notes in batches for better performance
	for (let batchStart = 0; batchStart < flatNotes.value.length; batchStart += batchSize) {
		const batchEnd = Math.min(batchStart + batchSize, flatNotes.value.length);

		// Load a batch of notes
		setTimeout(() => {
			for (let noteIndex = batchStart; noteIndex < batchEnd; noteIndex++) {
				if (flatNotes.value[noteIndex] && !flatNotes.value[noteIndex].loaded) {
					flatNotes.value[noteIndex].loaded = true;
				}
			}
		}, (batchStart / batchSize) * loadDelay);
	}

	console.log(`Loading ${flatNotes.value.length} notes with optimized batch loading (${batchSize} per batch, ${loadDelay}ms delay)`);
}

onMounted(async () => {
	taglineInterval = window.setInterval(() => {
		currentTaglineIndex.value = (currentTaglineIndex.value + 1) % taglines.value.length;
	}, 5000);

	// Fetch meta information
	try {
		meta.value = await os.api('meta', {});
	} catch (error) {
		console.error('Failed to fetch meta information:', error);
	}

	// Load featured notes for background
	await fetchFeaturedNotes();

	// Add window resize handler to recalculate notes
	window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
	clearInterval(taglineInterval);
	if (animationFrameId) {
		cancelAnimationFrame(animationFrameId);
	}
	window.removeEventListener('resize', handleResize);
});

// Handle window resize
function handleResize() {
	const newNotesNeeded = calculateNotesNeeded();
	if (newNotesNeeded !== totalNotesToShow.value) {
		console.log(`Screen size changed, recalculating notes: ${totalNotesToShow.value} -> ${newNotesNeeded}`);
		fetchFeaturedNotes();
	}
}

function signup() {
	os.popup(XSignupDialog, { autoSet: true }, {}, 'closed');
}

function signin() {
	os.popup(XSigninDialog, { autoSet: true }, {}, 'closed');
}

function explore() {
	router.push('/explore');
}

watch(lang, () => {
	miLocalStorage.setItem("lang", lang.value as string);
	miLocalStorage.removeItem("locale");
});

watch([lang], async () => {
	await reloadAsk();
});

async function reloadAsk() {
	const { canceled } = await os.confirm({
		type: "info",
		text: i18n.ts.reloadToApplySetting,
	});
	if (canceled) return;

	location.reload();
}
</script>

<style lang="scss" scoped>
@keyframes pulse-border {
	0% {
		border-color: rgba(var(--accent), 0.4);
	}

	50% {
		border-color: rgba(var(--accent), 1);
	}

	100% {
		border-color: rgba(var(--accent), 0.4);
	}
}

@keyframes bounce {

	0%,
	100% {
		transform: translateY(0);
	}

	50% {
		transform: translateY(-10px);
	}
}

@keyframes scroll-left {
	0% {
		transform: translateX(0) rotate(15deg);
	}

	100% {
		transform: translateX(-100%) rotate(15deg);
	}
}

@keyframes scroll-right {
	0% {
		transform: translateX(-100%) rotate(-15deg);
	}

	100% {
		transform: translateX(0) rotate(-15deg);
	}
}

@keyframes fade-in-scale {
	0% {
		opacity: 0;
		transform: scale(0.8);
	}

	100% {
		opacity: 1;
		transform: scale(1);
	}
}

.landing-page {
	height: 100vh;
	width: 100vw;
	overflow: hidden;
	position: relative;
	display: flex;
	flex-direction: column;
	justify-content: space-between;
	background: linear-gradient(135deg, var(--bg) 0%, var(--X2) 100%);
	color: var(--fg);
	font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

.original-background {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	z-index: 0;
	opacity: 0.3;

	>img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		background-position: center;
		background-size: cover;
	}
}

.featured-photos {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	z-index: 0;
	opacity: 0.3;
}

.barkle-background {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	z-index: 1;
	overflow: hidden;
	perspective: 1000px;

	.scrolling-container {
		position: absolute;
		top: -15%;
		/* Moved up more to eliminate top-left empty space */
		left: -15%;
		/* Expanded further to the left to fill left corners completely */
		width: 130%;
		/* Wider container */
		height: 130%;
		/* Taller container for better coverage */
		transform: rotate(-15deg);
		animation: vertical-scroll 60s linear infinite;
		/* Slower for smoother animation */

		/* Mobile optimization: Simpler positioning and slower animation */
		@media (max-width: 600px) {
			top: -10%;
			left: -10%;
			width: 120%;
			height: 120%;
			animation: vertical-scroll 80s linear infinite;
			/* Even slower on mobile for better performance */
		}
	}

	@keyframes vertical-scroll {
		0% {
			transform: translateY(0) rotate(-15deg);
		}

		50% {
			transform: translateY(-16.67%) rotate(-15deg);
			/* Middle position for smoother loop */
		}

		100% {
			transform: translateY(-33.33%) rotate(-15deg);
			/* Complete one third for perfect loop */
		}
	}

	.notes-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 15px;
		padding: 40px;
		/* Increased padding to avoid edge visibility */
		width: 140%;
		/* Even wider to fill left corners completely */
		height: 300vh;
		/* Triple height for smooth looping */
		opacity: 0.6;

		/* Mobile optimization: Smaller grid and reduced complexity */
		@media (max-width: 600px) {
			grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
			gap: 10px;
			padding: 20px;
			width: 120%;
			/* Smaller width for mobile */
			height: 200vh;
			/* Reduced height for mobile */
			opacity: 0.5;
			/* Slightly more transparent on mobile */
		}
	}

	.note-item {
		transition: all 0.3s ease;
		min-height: 160px; // Taller notes for better visibility
		max-height: 220px; // Increased max height further
		opacity: 0; // Start invisible for fade-in effect
		animation: fade-in-note 0.6s ease-out forwards;

		/* Mobile optimization: Smaller and lighter notes */
		@media (max-width: 600px) {
			min-height: 120px;
			max-height: 180px;
			transition: all 0.2s ease;
			/* Faster transitions on mobile */
		}

		&:hover {
			opacity: 0.8;
			transform: scale(1.02);

			/* Disable hover effects on mobile for better performance */
			@media (max-width: 600px) {
				transform: none;
			}
		}
	}

	@keyframes fade-in-note {
		0% {
			opacity: 0;
			transform: translateY(20px) scale(0.9);
		}

		100% {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	.background-note {
		pointer-events: none;
		height: 100%;
		width: 100%;
		display: flex;
		flex-direction: column;

		// Override MkNote styles for background effect with rounded box styling
		:deep(.tkcbzcuz) {
			background: rgba(var(--panel), 0.85) !important;
			border: 2px solid rgba(var(--accent), 0.15) !important;
			box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15) !important;
			backdrop-filter: blur(15px);
			border-radius: 12px !important; // Slightly larger border radius
			padding: 14px !important; // Increased padding for larger notes
			height: 100%;
			display: flex;
			flex-direction: column;
			overflow: hidden;

			/* Mobile optimization: Reduce heavy effects */
			@media (max-width: 600px) {
				backdrop-filter: none;
				/* Disable blur on mobile for better performance */
				background: rgba(var(--panel), 0.7) !important;
				/* More transparent background */
				box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1) !important;
				/* Lighter shadow */
				padding: 10px !important;
				/* Smaller padding */
			}

			// Ensure proper rounded corners throughout
			* {
				border-radius: inherit;
			}

			.article {
				height: 100%;
				display: flex;
				flex-direction: column;

				.main {
					flex: 1;
					display: flex;
					flex-direction: column;

					.header {
						padding-bottom: 6px; // Reduced padding
						border-bottom: 1px solid rgba(var(--accent), 0.1);
						margin-bottom: 8px; // Reduced margin

						.avatar {
							border-radius: 50% !important;
						}
					}

					.body {
						flex: 1;
						overflow: hidden;

						.text {
							// Limit text length for better visual effect
							display: -webkit-box;
							-webkit-line-clamp: 4; // Increased lines for larger notes
							line-clamp: 4;
							-webkit-box-orient: vertical;
							overflow: hidden;
							font-size: 0.9em; // Slightly larger font
							line-height: 1.4;
							color: rgba(var(--fg), 0.8);
						}

						.files {
							margin-top: 8px;

							img,
							video {
								border-radius: 8px !important;
								max-height: 100px; // Increased attachment size for larger notes
								object-fit: cover;
								width: 100%;
							}
						}
					}
				}

				.footer {
					margin-top: auto;
					padding-top: 6px; // Reduced padding
					border-top: 1px solid rgba(var(--accent), 0.1);
					opacity: 0.7;
					font-size: 0.8em; // Smaller footer text
				}
			}
		}
	}

	.note-skeleton {
		width: 100%;
		height: 100%; // Fill the grid item height
		background: linear-gradient(90deg,
				rgba(var(--panel), 0.4) 25%,
				rgba(var(--panel), 0.6) 50%,
				rgba(var(--panel), 0.4) 75%);
		background-size: 200% 100%;
		animation: skeleton-shimmer 2s infinite;
		border-radius: 16px;
		border: 2px solid rgba(var(--accent), 0.15);
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
		backdrop-filter: blur(15px);

		/* Mobile optimization: Simpler skeleton */
		@media (max-width: 600px) {
			backdrop-filter: none;
			/* Disable blur on mobile */
			animation: skeleton-shimmer 3s infinite;
			/* Slower animation on mobile */
			box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
			/* Lighter shadow */
			border-radius: 12px;
		}

		// Add some internal structure to the skeleton
		position: relative;

		&::before {
			content: '';
			position: absolute;
			top: 16px;
			left: 16px;
			right: 16px;
			height: 40px;
			background: rgba(var(--accent), 0.1);
			border-radius: 8px;
		}

		&::after {
			content: '';
			position: absolute;
			top: 70px;
			left: 16px;
			right: 16px;
			bottom: 16px;
			background: rgba(var(--accent), 0.05);
			border-radius: 8px;
		}
	}

	@keyframes skeleton-shimmer {
		0% {
			background-position: 200% 0;
		}

		100% {
			background-position: -200% 0;
		}
	}

	// Gradient overlays for barkle-style vignette effect
	.gradient-overlay {
		position: absolute;
		pointer-events: none;
		z-index: 2;

		&.top {
			top: 0;
			left: 0;
			right: 0;
			height: 30%;
			background: linear-gradient(to bottom,
					rgba(var(--bg), 0.9) 0%,
					rgba(var(--bg), 0.7) 40%,
					rgba(var(--bg), 0.3) 70%,
					transparent 100%);
		}

		&.bottom {
			bottom: 0;
			left: 0;
			right: 0;
			height: 30%;
			background: linear-gradient(to top,
					rgba(var(--bg), 0.9) 0%,
					rgba(var(--bg), 0.7) 40%,
					rgba(var(--bg), 0.3) 70%,
					transparent 100%);
		}

		&.left {
			top: 0;
			bottom: 0;
			left: 0;
			width: 20%;
			background: linear-gradient(to right,
					rgba(var(--bg), 0.8) 0%,
					rgba(var(--bg), 0.4) 50%,
					transparent 100%);
		}

		&.right {
			top: 0;
			bottom: 0;
			right: 0;
			width: 20%;
			background: linear-gradient(to left,
					rgba(var(--bg), 0.8) 0%,
					rgba(var(--bg), 0.4) 50%,
					transparent 100%);
		}
	}

	.center-spotlight {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 60%;
		height: 60%;
		transform: translate(-50%, -50%);
		background: radial-gradient(ellipse at center,
				transparent 0%,
				transparent 30%,
				rgba(var(--bg), 0.3) 60%,
				rgba(var(--bg), 0.8) 100%);
		pointer-events: none;
		z-index: 2;
	}
}

.content-wrapper {
	position: relative;
	z-index: 3;
	display: flex;
	flex-direction: column;
	justify-content: space-between;
	height: 100%;
	padding: 2rem;
}

header {
	text-align: center;
	z-index: 4;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	height: 70%;

	.logo {
		margin-bottom: .2rem;
		animation: bounce 2s infinite;

		.logo-image {
			max-width: 150px;
			height: auto;
			filter: drop-shadow(0 0 20px rgba(var(--accent), 0.5));
		}

		.logo-text {
			font-size: 2rem;
			font-weight: bold;
			color: var(--accent);
			text-shadow: 0 0 20px rgba(var(--accent), 0.8);
		}
	}

	h1 {
		font-size: 3.5rem;
		margin-bottom: 1rem;
		color: var(--accent);
		text-shadow: 0 0 30px rgba(var(--accent), 0.6);
		letter-spacing: 4px;
		font-weight: 700;
	}

	.tagline-container {
		height: 3em;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.tagline {
		font-size: 2.2rem;
		line-height: 1.5;
		max-width: 800px;
		font-family: Arial, Helvetica, sans-serif;
		margin: 0 auto;
		color: var(--fg);
		text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
		font-weight: 300;
	}
}

footer {
	display: flex;
	justify-content: center;
	align-items: center;
	width: 100%;
	z-index: 4;

	.auth-container {
		background: rgba(var(--panel), 0.8);
		backdrop-filter: blur(20px);
		border-radius: 20px;
		padding: 2rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
		border: 1px solid rgba(var(--accent), 0.2);
	}

	.pre-release-notice {
		margin-bottom: 1.5rem;
		text-align: center;
		width: 100%;
		max-width: 500px;

		.pre-release-content {
			background: linear-gradient(135deg, rgba(var(--accent), 0.15), rgba(var(--accent), 0.25));
			border: 2px solid rgba(var(--accent), 0.3);
			border-radius: 16px;
			padding: 1.5rem;
			backdrop-filter: blur(10px);
			box-shadow: 0 4px 20px rgba(var(--accent), 0.2);

			h3 {
				color: var(--accent);
				margin: 0 0 1rem 0;
				font-size: 1.3rem;
				font-weight: 700;
				display: flex;
				align-items: center;
				justify-content: center;
				gap: 0.5rem;
			}

			p {
				margin: 0.5rem 0;
				color: var(--fg);
				font-size: 0.95rem;
				line-height: 1.5;
				opacity: 0.9;
			}

			.exclusive-text {
				color: var(--accent);
				font-weight: 600;
				font-size: 1rem;
				margin-top: 1rem;
			}
		}
	}

	.pre-release-signup-message {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: 0.8rem 1rem;
		background: rgba(var(--warn), 0.1);
		border: 1px solid rgba(var(--warn), 0.3);
		border-radius: 12px;
		min-width: 120px;

		p {
			margin: 0;
			color: var(--warn);
			font-size: 0.9rem;
			line-height: 1.4;
			font-weight: 500;
		}
	}

	.auth-buttons {
		display: flex;
		gap: 1rem;
		width: 100%;
		max-width: 400px;
		justify-content: center;

		.signin-button,
		.signup-button {
			flex: 1;
			font-weight: 600;
			font-size: 1.1rem;
			padding: 0.8rem 0;
			min-width: 120px;
			transition: all 0.3s ease;
			position: relative;
			overflow: hidden;

			&::before {
				content: '';
				position: absolute;
				top: -2px;
				left: -2px;
				right: -2px;
				bottom: -2px;
				border-radius: 9999px;
				background: transparent;
				z-index: -1;
				animation: pulse-border 2s infinite;
			}

			&:hover {
				transform: translateY(-3px);
				box-shadow: 0 8px 25px rgba(var(--accent), 0.3);

				&::before {
					animation-duration: 1s;
				}
			}
		}

		.signin-button {
			background: transparent;
			border: 2px solid var(--accent);
			color: var(--accent);

			&:hover {
				background: rgba(var(--accent), 0.1);
			}
		}

		.signup-button {
			background: var(--accent);
			border: none;
			color: var(--fgOnAccent);

			&:hover {
				background: var(--accentLighten);
			}

			&::before {
				border: 2px solid var(--accentLighten);
			}
		}
	}
}

.fade-enter-active,
.fade-leave-active {
	transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}

@media (max-width: 768px) {
	.barkle-background {
		.note-card {
			min-width: 200px;
			max-width: 200px;
			height: 80px;
		}

		.note-row {
			gap: 15px;
			height: 100px;
		}
	}
}

@media (max-width: 600px) {
	.landing-page {
		.content-wrapper {
			padding: 1.5rem;
		}

		header {
			.logo {
				.logo-image {
					max-width: 100px;
				}

				.logo-text {
					font-size: 1.5rem;
				}
			}

			h1 {
				font-size: 2.5rem;
			}

			.tagline {
				font-size: 1.2rem;
			}
		}

		footer {
			.auth-container {
				width: 100%;
				padding: 1.5rem;
			}

			.auth-buttons {

				.signin-button,
				.signup-button {
					padding: 0.8rem 0;
				}
			}
		}
	}

	.barkle-background {
		.note-card {
			min-width: 150px;
			max-width: 150px;
			height: 60px;
		}

		.note-row {
			gap: 10px;
			height: 80px;
		}
	}
}
</style>