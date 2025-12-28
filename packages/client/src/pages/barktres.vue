<template>
	<MkStickyContainer>
		<template #header>
			<MkPageHeader :actions="headerActions" :tabs="headerTabs" />
		</template>
		<MkSpacer :content-max="800" :margin-min="20">
			<div class="barktres-container">
				<BarktresMenu v-if="!gameStarted" :stats="myStats" @start-game="startGame"
					@show-leaderboard="toggleLeaderboard" />

				<BarktresGame v-else ref="gameComponent" :score="score" :lines="lines" :level="level"
					:is-game-over="gameOver" @move-left="moveLeft" @move-right="moveRight" @rotate="rotate"
					@soft-drop="softDrop" @hard-drop="hardDrop" @hold-piece="handleHoldPiece"
					@return-to-menu="returnToMenu" />
				<BarktresLeaderboard :show="showLeaderboard" :entries="leaderboard" @close="showLeaderboard = false" />
			</div>
		</MkSpacer>
	</MkStickyContainer>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import BarktresMenu from '@/components/barktres/BarktresMenu.vue';
import BarktresGame from '@/components/barktres/BarktresGame.vue';
import BarktresLeaderboard from '@/components/barktres/BarktresLeaderboard.vue';
import { i18n } from '@/i18n';
import * as os from '@/os';
import { definePageMetadata } from '@/scripts/page-metadata';
import { $i } from '@/account';
import {
	initBoard,
	createPiece,
	collision as checkCollision,
	merge,
	clearLines,
	calculateScore,
	calculateLevel,
	rotatePiece,
	draw,
	drawPreview,
	type Piece,
} from '@/scripts/barktres-game-logic';

// Wrapper for collision check using current board
function collision(piece: Piece, offsetX = 0, offsetY = 0): boolean {
	return checkCollision(piece, board.value, offsetX, offsetY);
}

// Reactive state
const gameStarted = ref(false);
const gameOver = ref(false);
const score = ref(0);
const lines = ref(0);
const level = ref(1);
const board = ref<number[][]>([]);
const currentPiece = ref<Piece | null>(null);
const nextPiece = ref<Piece | null>(null);
const holdPiece = ref<Piece | null>(null);
const canHold = ref(true);
const sessionToken = ref<string | null>(null);
const gameStartTime = ref<number>(0);
const showLeaderboard = ref(false);
const leaderboard = ref<any[]>([]);
const myStats = ref<any>(null);

// Component ref
const gameComponent = ref<InstanceType<typeof BarktresGame> | null>(null);

// Game state
let gameLoopInterval: NodeJS.Timeout | null = null;
let ctx: CanvasRenderingContext2D | null = null;

// Movement functions
function moveLeft() {
	if (!currentPiece.value || gameOver.value) return;
	if (!collision(currentPiece.value, -1, 0)) {
		currentPiece.value.x--;
		drawGame();
	}
}

function moveRight() {
	if (!currentPiece.value || gameOver.value) return;
	if (!collision(currentPiece.value, 1, 0)) {
		currentPiece.value.x++;
		drawGame();
	}
}

function rotate() {
	if (!currentPiece.value || gameOver.value) return;

	const rotated = rotatePiece(currentPiece.value);

	if (!collision(rotated)) {
		currentPiece.value = rotated;
		drawGame();
	}
}

function softDrop() {
	if (!currentPiece.value || gameOver.value) return;
	if (!collision(currentPiece.value, 0, 1)) {
		currentPiece.value.y++;
		drawGame();
	}
}

function hardDrop() {
	if (!currentPiece.value || gameOver.value) return;

	let dropDistance = 0;
	while (!collision(currentPiece.value, 0, 1)) {
		currentPiece.value.y++;
		dropDistance++;
	}

	// No scoring for hard drop - only line clears give points
	drawGame();
	lockPiece();
}

// Lock piece and spawn new one
function lockPiece() {
	if (!currentPiece.value) return;

	merge(currentPiece.value, board.value);
	processLineClears();

	// Spawn next piece
	currentPiece.value = nextPiece.value;
	nextPiece.value = createPiece();
	canHold.value = true;

	if (currentPiece.value && collision(currentPiece.value)) {
		endGame();
		return;
	}

	drawGame();
}

// Process line clearing
function processLineClears() {
	const result = clearLines(board.value);
	board.value = result.newBoard;

	if (result.linesCleared > 0) {
		lines.value += result.linesCleared;
		score.value += calculateScore(result.linesCleared, level.value);

		const newLevel = calculateLevel(lines.value);
		if (newLevel > level.value) {
			level.value = newLevel;
			updateGameSpeed();
		}
	}
}

// Calculate drop interval based on level (Tetris Guideline)
function calculateDropInterval(level: number): number {
	// Tetris Guideline drop speeds (frames per drop)
	let framesPerDrop: number;

	if (level === 1) framesPerDrop = 48;
	else if (level === 2) framesPerDrop = 43;
	else if (level === 3) framesPerDrop = 38;
	else if (level === 4) framesPerDrop = 33;
	else if (level === 5) framesPerDrop = 28;
	else if (level === 6) framesPerDrop = 23;
	else if (level === 7) framesPerDrop = 18;
	else if (level === 8) framesPerDrop = 13;
	else if (level === 9) framesPerDrop = 8;
	else if (level === 10) framesPerDrop = 6;
	else if (level <= 12) framesPerDrop = 5;
	else if (level <= 15) framesPerDrop = 4;
	else if (level <= 18) framesPerDrop = 3;
	else if (level <= 28) framesPerDrop = 2;
	else framesPerDrop = 1; // Level 29+

	// Convert frames to milliseconds (assuming 60 FPS target)
	// Cap minimum at 50ms for playability
	return Math.max(50, Math.round((framesPerDrop / 60) * 1000));
}

// Update game speed based on level (Tetris Guideline)
function updateGameSpeed() {
	if (gameLoopInterval) {
		clearInterval(gameLoopInterval);
		const dropInterval = calculateDropInterval(level.value);
		gameLoopInterval = setInterval(gameLoop, dropInterval);
	}
}

// Main game loop
function gameLoop() {
	if (!currentPiece.value || gameOver.value) return;

	if (!collision(currentPiece.value, 0, 1)) {
		currentPiece.value.y++;
		drawGame();
	} else {
		lockPiece();
	}
}

// Draw game state
function drawGame() {
	if (!ctx || !gameComponent.value?.gameCanvas) return;
	draw(ctx, gameComponent.value.gameCanvas, board.value, currentPiece.value);

	// Draw hold piece
	if (gameComponent.value.holdCanvas) {
		const holdCtx = gameComponent.value.holdCanvas.getContext('2d');
		if (holdCtx) {
			drawPreview(holdCtx, gameComponent.value.holdCanvas, holdPiece.value);
		}
	}

	// Draw next piece
	if (gameComponent.value.nextCanvas) {
		const nextCtx = gameComponent.value.nextCanvas.getContext('2d');
		if (nextCtx) {
			drawPreview(nextCtx, gameComponent.value.nextCanvas, nextPiece.value);
		}
	}
}

// Handle hold piece function
function handleHoldPiece() {
	if (!canHold.value || !currentPiece.value || gameOver.value) return;

	if (holdPiece.value === null) {
		// First hold - store current piece and spawn next
		holdPiece.value = { ...currentPiece.value, x: 0, y: 0 };
		currentPiece.value = nextPiece.value;
		nextPiece.value = createPiece();
	} else {
		// Swap hold piece with current piece
		const temp = holdPiece.value;
		holdPiece.value = { ...currentPiece.value, x: 0, y: 0 };
		currentPiece.value = { ...temp };

		// Reset position for swapped piece
		if (currentPiece.value) {
			currentPiece.value.x = Math.floor(10 / 2) - Math.floor(currentPiece.value.shape[0].length / 2);
			currentPiece.value.y = 0;
		}
	}

	canHold.value = false;
	drawGame();
}

// Keyboard controls
function handleKeyPress(e: KeyboardEvent) {
	if (!gameStarted.value || gameOver.value) return;

	switch (e.key) {
		case 'ArrowLeft':
			e.preventDefault();
			moveLeft();
			break;
		case 'ArrowRight':
			e.preventDefault();
			moveRight();
			break;
		case 'ArrowDown':
			e.preventDefault();
			softDrop();
			break;
		case 'ArrowUp':
		case ' ':
			e.preventDefault();
			rotate();
			break;
		case 'Enter':
			e.preventDefault();
			hardDrop();
			break;
		case 'c':
		case 'C':
		case 'Shift':
			e.preventDefault();
			handleHoldPiece();
			break;
	}
}

// Start a new game
async function startGame() {
	if (!$i) {
		os.alert({
			type: 'error',
			text: i18n.ts.barktresLoginRequired || 'Please login to play',
		});
		return;
	}

	try {
		const session = await os.api('barktres/start-session') as any;
		sessionToken.value = session.sessionToken;
		gameStartTime.value = session.startTime;

		board.value = initBoard();
		score.value = 0;
		lines.value = 0;
		level.value = 1;
		gameOver.value = false;
		canHold.value = true;
		holdPiece.value = null;
		nextPiece.value = createPiece();
		currentPiece.value = createPiece();

		gameStarted.value = true;

		// Wait for next tick to ensure component is mounted
		await new Promise(resolve => setTimeout(resolve, 0));

		if (gameComponent.value?.gameCanvas) {
			ctx = gameComponent.value.gameCanvas.getContext('2d');
			if (!ctx) {
				throw new Error('Failed to get canvas context');
			}
		}

		const dropInterval = calculateDropInterval(level.value);
		gameLoopInterval = setInterval(gameLoop, dropInterval);

		drawGame();
	} catch (error) {
		console.error('Failed to start game:', error);
		os.alert({
			type: 'error',
			text: i18n.ts.barktresStartError || 'Failed to start game. Please try again.',
		});
	}
}

// End game and submit score
async function endGame() {
	gameOver.value = true;

	if (gameLoopInterval) {
		clearInterval(gameLoopInterval);
		gameLoopInterval = null;
	}

	if (sessionToken.value && $i) {
		try {
			const duration = Date.now() - gameStartTime.value;
			const result = await os.api('barktres/submit-score', {
				sessionToken: sessionToken.value,
				score: score.value,
				lines: lines.value,
				level: level.value,
				duration,
			}) as any;

			if (result.rank) {
				setTimeout(() => {
					os.alert({
						type: 'success',
						text: `${i18n.ts.barktresRankMessage || 'Your rank:'} #${result.rank}`,
					});
				}, 500);
			}

			loadLeaderboard();
			loadMyStats();
		} catch (error) {
			console.error('Failed to submit score:', error);
		}
	}
}

// Return to main menu
function returnToMenu() {
	gameStarted.value = false;
	gameOver.value = false;

	if (gameLoopInterval) {
		clearInterval(gameLoopInterval);
		gameLoopInterval = null;
	}

	if (ctx && gameComponent.value?.gameCanvas) {
		ctx.fillStyle = '#1a1a2e';
		ctx.fillRect(0, 0, gameComponent.value.gameCanvas.width, gameComponent.value.gameCanvas.height);
	}
}

// Toggle leaderboard display
function toggleLeaderboard() {
	showLeaderboard.value = !showLeaderboard.value;
	if (showLeaderboard.value) {
		loadLeaderboard();
	}
}

// Load leaderboard from server
async function loadLeaderboard() {
	try {
		const result = await os.api('barktres/leaderboard', { limit: 10 }) as any;
		leaderboard.value = result || [];
	} catch (error) {
		console.error('Failed to load leaderboard:', error);
		leaderboard.value = [];
	}
}

// Load user stats from server
async function loadMyStats() {
	if (!$i) return;

	try {
		const result = await os.api('barktres/my-scores', { limit: 5 }) as any;
		myStats.value = result || null;
	} catch (error) {
		console.error('Failed to load stats:', error);
		myStats.value = null;
	}
}

onMounted(() => {
	window.addEventListener('keydown', handleKeyPress);
	loadLeaderboard();
	loadMyStats();
});

onBeforeUnmount(() => {
	window.removeEventListener('keydown', handleKeyPress);
	if (gameLoopInterval) {
		clearInterval(gameLoopInterval);
	}
});

const headerActions = computed(() => []);
const headerTabs = computed(() => []);

definePageMetadata({
	title: 'Barktres',
	icon: 'ph-game-controller-bold ph-lg',
});
</script>

<style lang="scss" scoped>
.barktres-container {
	padding: 20px;
	max-width: 800px;
	margin: 0 auto;
}

@media (max-width: 600px) {
	.barktres-container {
		padding: 12px;
	}
}
</style>
