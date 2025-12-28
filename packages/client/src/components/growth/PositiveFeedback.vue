<template>
	<div class="positive-feedback">
		<Transition name="celebration" appear>
			<div v-if="showCelebration" class="celebration-container">
				<div class="celebration-content">
					<div class="celebration-icon">
						<MkEmoji :emoji="milestone.icon" :custom-emojis="[]" :is-reaction="false" />
					</div>
					<h2 class="celebration-title">{{ milestone.title }}</h2>
					<p class="celebration-message">{{ milestone.body }}</p>
					
					<div v-if="milestone.actionText" class="celebration-actions">
						<MkButton 
							:to="milestone.actionUrl" 
							primary 
							class="celebration-action"
						>
							{{ milestone.actionText }}
						</MkButton>
					</div>
					
					<div class="celebration-close">
						<MkButton @click="closeCelebration" transparent>
							{{ i18n.ts.close }}
						</MkButton>
					</div>
				</div>
				
				<div class="celebration-particles">
					<div 
						v-for="i in 20" 
						:key="i" 
						class="particle"
						:style="getParticleStyle(i)"
					></div>
				</div>
			</div>
		</Transition>
		
		<!-- Achievement Display -->
		<div v-if="achievements.length > 0" class="achievements-section">
			<h3 class="achievements-title">{{ i18n.ts.yourAchievements }}</h3>
			<div class="achievements-grid">
				<div 
					v-for="achievement in achievements" 
					:key="achievement.id"
					class="achievement-card"
					:class="{ recent: achievement.isRecent }"
				>
					<div class="achievement-icon">
						<MkEmoji :emoji="achievement.icon" :custom-emojis="[]" :is-reaction="false" />
					</div>
					<div class="achievement-info">
						<h4 class="achievement-name">{{ achievement.name }}</h4>
						<p class="achievement-description">{{ achievement.description }}</p>
						<time class="achievement-date">{{ formatDate(achievement.earnedAt) }}</time>
					</div>
				</div>
			</div>
		</div>
		
		<!-- Encouragement Messages -->
		<div v-if="encouragementMessage" class="encouragement-section">
			<div class="encouragement-card">
				<div class="encouragement-icon">
					<MkEmoji emoji="✨" :custom-emojis="[]" :is-reaction="false" />
				</div>
				<div class="encouragement-content">
					<h4 class="encouragement-title">{{ encouragementMessage.title }}</h4>
					<p class="encouragement-text">{{ encouragementMessage.text }}</p>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import * as os from '@/os';
import { i18n } from '@/i18n';
import { $i } from '@/account';

interface Milestone {
	icon: string;
	title: string;
	body: string;
	actionText?: string;
	actionUrl?: string;
}

interface Achievement {
	id: string;
	name: string;
	description: string;
	icon: string;
	earnedAt: Date;
	isRecent: boolean;
}

interface EncouragementMessage {
	title: string;
	text: string;
}

const props = defineProps<{
	milestone?: Milestone;
	autoShow?: boolean;
}>();

const emit = defineEmits<{
	closed: [];
}>();

const showCelebration = ref(false);
const achievements = ref<Achievement[]>([]);
const encouragementMessage = ref<EncouragementMessage | null>(null);

// Show celebration when milestone prop changes
watch(() => props.milestone, (newMilestone) => {
	if (newMilestone && props.autoShow !== false) {
		showCelebration.value = true;
		// Auto-hide after 5 seconds
		setTimeout(() => {
			if (showCelebration.value) {
				closeCelebration();
			}
		}, 5000);
	}
}, { immediate: true });

onMounted(async () => {
	await loadAchievements();
	await loadEncouragement();
});

async function loadAchievements() {
	try {
		// Mock achievements for now - in real implementation, this would come from API
		achievements.value = [
			{
				id: '1',
				name: i18n.ts.firstPostAchievement || 'First Post',
				description: i18n.ts.firstPostDescription || 'You shared your first thought with the community!',
				icon: '🎉',
				earnedAt: new Date(Date.now() - 86400000), // 1 day ago
				isRecent: true
			},
			{
				id: '2', 
				name: i18n.ts.firstFollowerAchievement || 'First Follower',
				description: i18n.ts.firstFollowerDescription || 'Someone found your content interesting!',
				icon: '👥',
				earnedAt: new Date(Date.now() - 172800000), // 2 days ago
				isRecent: false
			}
		];
	} catch (error) {
		console.error('Failed to load achievements:', error);
	}
}

async function loadEncouragement() {
	try {
		// Check if user needs encouragement
		if ($i && shouldShowEncouragement()) {
			encouragementMessage.value = generateEncouragementMessage();
		}
	} catch (error) {
		console.error('Failed to load encouragement:', error);
	}
}

function shouldShowEncouragement(): boolean {
	if (!$i) return false;
	
	// Show encouragement for new users or users with low engagement
	const daysSinceJoined = Math.floor((Date.now() - new Date($i.createdAt).getTime()) / (1000 * 60 * 60 * 24));
	
	return daysSinceJoined <= 7 || $i.notesCount < 5 || $i.followersCount === 0;
}

function generateEncouragementMessage(): EncouragementMessage {
	const messages = [
		{
			title: i18n.ts.keepGoing || 'Keep Going!',
			text: i18n.ts.encouragementMessage1 || 'Every great community member started somewhere. Your unique perspective matters here!'
		},
		{
			title: i18n.ts.youreAwesome || 'You\'re Awesome!',
			text: i18n.ts.encouragementMessage2 || 'Thank you for being part of our community. Your contributions make Barkle a better place!'
		},
		{
			title: i18n.ts.shareYourThoughts || 'Bark it out!',
			text: i18n.ts.encouragementMessage3 || 'We\'d love to hear what you\'re thinking about. Don\'t be shy - your voice matters!'
		}
	];
	
	return messages[Math.floor(Math.random() * messages.length)];
}

function closeCelebration() {
	showCelebration.value = false;
	emit('closed');
}

function getParticleStyle(index: number) {
	const angle = (index / 20) * 360;
	const distance = 100 + Math.random() * 50;
	const x = Math.cos(angle * Math.PI / 180) * distance;
	const y = Math.sin(angle * Math.PI / 180) * distance;
	
	return {
		'--x': `${x}px`,
		'--y': `${y}px`,
		'--delay': `${Math.random() * 2}s`,
		'--duration': `${2 + Math.random() * 2}s`
	};
}

function formatDate(date: Date): string {
	return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
		Math.floor((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
		'day'
	);
}
</script>

<style lang="scss" scoped>
.positive-feedback {
	position: relative;
}

.celebration-container {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background: rgba(0, 0, 0, 0.8);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 10000;
	backdrop-filter: blur(4px);
}

.celebration-content {
	background: var(--panel);
	border-radius: 16px;
	padding: 2rem;
	max-width: 400px;
	text-align: center;
	box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
	position: relative;
	z-index: 2;
}

.celebration-icon {
	font-size: 4rem;
	margin-bottom: 1rem;
	animation: bounce 1s ease-in-out infinite alternate;
}

.celebration-title {
	font-size: 1.5rem;
	font-weight: bold;
	color: var(--accent);
	margin-bottom: 0.5rem;
}

.celebration-message {
	color: var(--fg);
	margin-bottom: 1.5rem;
	line-height: 1.5;
}

.celebration-actions {
	margin-bottom: 1rem;
}

.celebration-action {
	margin: 0 0.5rem;
}

.celebration-close {
	opacity: 0.7;
}

.celebration-particles {
	position: absolute;
	top: 50%;
	left: 50%;
	pointer-events: none;
}

.particle {
	position: absolute;
	width: 8px;
	height: 8px;
	background: var(--accent);
	border-radius: 50%;
	animation: particle-float var(--duration) ease-out var(--delay) infinite;
	transform: translate(-50%, -50%);
}

.achievements-section {
	margin-top: 2rem;
}

.achievements-title {
	font-size: 1.2rem;
	font-weight: bold;
	margin-bottom: 1rem;
	color: var(--fg);
}

.achievements-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
	gap: 1rem;
}

.achievement-card {
	background: var(--panel);
	border-radius: 12px;
	padding: 1rem;
	display: flex;
	align-items: center;
	gap: 1rem;
	transition: all 0.2s ease;
	border: 2px solid transparent;
	
	&.recent {
		border-color: var(--accent);
		box-shadow: 0 0 20px rgba(var(--accent-rgb), 0.2);
	}
	
	&:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}
}

.achievement-icon {
	font-size: 2rem;
	flex-shrink: 0;
}

.achievement-info {
	flex: 1;
}

.achievement-name {
	font-weight: bold;
	color: var(--fg);
	margin-bottom: 0.25rem;
}

.achievement-description {
	color: var(--fg);
	opacity: 0.8;
	font-size: 0.9rem;
	margin-bottom: 0.25rem;
}

.achievement-date {
	color: var(--fg);
	opacity: 0.6;
	font-size: 0.8rem;
}

.encouragement-section {
	margin-top: 2rem;
}

.encouragement-card {
	background: linear-gradient(135deg, var(--accent) 0%, var(--accent-lighten) 100%);
	border-radius: 12px;
	padding: 1.5rem;
	display: flex;
	align-items: center;
	gap: 1rem;
	color: white;
}

.encouragement-icon {
	font-size: 2rem;
	flex-shrink: 0;
}

.encouragement-title {
	font-weight: bold;
	margin-bottom: 0.5rem;
}

.encouragement-text {
	opacity: 0.9;
	line-height: 1.4;
}

// Animations
.celebration-enter-active,
.celebration-leave-active {
	transition: all 0.3s ease;
}

.celebration-enter-from,
.celebration-leave-to {
	opacity: 0;
	transform: scale(0.8);
}

@keyframes bounce {
	0% { transform: translateY(0); }
	100% { transform: translateY(-10px); }
}

@keyframes particle-float {
	0% {
		transform: translate(-50%, -50%) translate(0, 0);
		opacity: 1;
	}
	100% {
		transform: translate(-50%, -50%) translate(var(--x), var(--y));
		opacity: 0;
	}
}

// Responsive design
@media (max-width: 600px) {
	.celebration-content {
		margin: 1rem;
		padding: 1.5rem;
	}
	
	.achievements-grid {
		grid-template-columns: 1fr;
	}
	
	.achievement-card {
		flex-direction: column;
		text-align: center;
	}
	
	.encouragement-card {
		flex-direction: column;
		text-align: center;
	}
}
</style>