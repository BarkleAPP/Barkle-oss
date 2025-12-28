<template>
	<div class="quick-bark-creator">
		<!-- Text story mode -->
		<div v-if="textStoryMode && !previewUrl" class="text-story-mode" :style="{ background: backgroundColor }">
			<div class="story-header">
				<button class="icon-btn" @click="clearFile">
					<i class="ti ti-x"></i>
				</button>
				<div class="header-actions">
					<button class="icon-btn" @click="selectBackgroundColor">
						<i class="ti ti-palette"></i>
					</button>
					<button class="icon-btn" @click="toggleTextAlignment">
						<i class="ti ti-align-center"></i>
					</button>
				</div>
			</div>

			<div class="text-story-content">
				<textarea v-model="content" :placeholder="i18n.ts.typeMessage || 'Type your story...'"
					class="text-story-input" :style="{ textAlign: textAlignment }" autofocus maxlength="200"></textarea>
			</div>

			<div class="story-footer">
				<div class="char-count">{{ content.length }}/200</div>
				<button class="send-btn" @click="createBark" :disabled="creating || !content">
					<span>{{ i18n.ts._quickBark.yourStory || 'Your story' }}</span>
					<i class="ti ti-arrow-right"></i>
				</button>
			</div>
		</div>

		<!-- Preview mode when file is selected -->
		<div v-else-if="previewUrl" class="preview-mode">
			<div class="story-header">
				<button class="icon-btn" @click="clearFile">
					<i class="ti ti-x"></i>
				</button>
				<div class="header-actions">
					<button class="icon-btn" @click="showTextEditor">
						<i class="ti ti-text-size"></i>
					</button>
					<button class="icon-btn" @click="toggleDrawMode">
						<i class="ti ti-pencil"></i>
					</button>
					<button class="icon-btn" @click="addSticker">
						<i class="ti ti-sticker"></i>
					</button>
				</div>
			</div>

			<div class="preview-content">
				<img v-if="fileType === 'image' || fileType === 'gif'" :src="previewUrl" class="media-preview" />
				<video v-else-if="fileType === 'video'" :src="previewUrl" class="media-preview" controls></video>
				
				<!-- Canvas for drawing -->
				<canvas v-if="drawMode" ref="drawCanvas" class="draw-canvas" @touchstart="startDrawing" 
					@touchmove="draw" @touchend="stopDrawing" @mousedown="startDrawing" 
					@mousemove="draw" @mouseup="stopDrawing"></canvas>
				
				<!-- Text overlays -->
				<div v-for="(text, index) in textOverlays" :key="index" class="text-overlay-item" 
					:style="{ top: text.y + 'px', left: text.x + 'px', color: text.color, fontSize: text.size + 'px' }">
					{{ text.content }}
				</div>
			</div>

			<div class="story-footer">
				<input v-if="content" v-model="content" type="text" class="caption-input" 
					:placeholder="i18n.ts._quickBark.addCaption || 'Add a caption...'" maxlength="200" />
				<button class="send-btn" @click="createBark" :disabled="creating">
					<span>{{ i18n.ts._quickBark.yourStory || 'Your story' }}</span>
					<i class="ti ti-arrow-right"></i>
				</button>
			</div>
		</div>

		<!-- Camera-first creation mode (Instagram/Stories style) -->
		<div v-else class="camera-mode">
			<div class="camera-header">
				<button class="icon-btn" @click="close">
					<i class="ti ti-x"></i>
				</button>
				<h3>{{ i18n.ts._quickBark.createStory || 'Create Story' }}</h3>
				<button class="icon-btn" @click="showSettings">
					<i class="ti ti-settings"></i>
				</button>
			</div>

			<div class="camera-view">
				<!-- Camera placeholder - in real Instagram, this would be live camera feed -->
				<div class="camera-placeholder">
					<i class="ti ti-camera"></i>
					<p>{{ i18n.ts._quickBark.tapToSelectMedia || 'Tap below to select media or create text story' }}</p>
				</div>
			</div>

			<div class="camera-controls">
				<button class="control-btn gallery-btn" @click="selectMedia">
					<div class="btn-icon">
						<i class="ti ti-photo"></i>
					</div>
					<span>{{ i18n.ts.gallery || 'Gallery' }}</span>
				</button>
				
				<button class="control-btn capture-btn" @click="selectMedia">
					<div class="capture-circle">
						<div class="capture-inner"></div>
					</div>
				</button>
				
				<button class="control-btn text-btn" @click="createTextStory">
					<div class="btn-icon">
						<i class="ti ti-text-size"></i>
					</div>
					<span>{{ i18n.ts.text || 'Text' }}</span>
				</button>
			</div>

			<div v-if="sharedNote" class="share-note-banner">
				<div class="banner-header">
					<i class="ti ti-share"></i>
					<span>{{ i18n.ts._quickBark.shareThisBark || 'Share this bark to your story' }}</span>
				</div>
				<div class="note-preview-card">
					<div class="note-preview-header">
						<MkAvatar :user="sharedNote.user" class="preview-avatar" :show-indicator="false" />
						<div class="preview-user-info">
							<MkUserName :user="sharedNote.user" :nowrap="true" class="preview-username" />
							<span class="preview-handle">@{{ sharedNote.user.username }}</span>
						</div>
					</div>
					<div v-if="sharedNote.text" class="note-preview-text">
						<Mfm :text="sharedNote.text" :author="sharedNote.user" :i="$i" 
							:custom-emojis="sharedNote.emojis" />
					</div>
					<div v-if="sharedNote.files && sharedNote.files.length > 0" class="note-preview-media">
						<img v-if="sharedNote.files[0].type.startsWith('image/')" 
							:src="sharedNote.files[0].thumbnailUrl || sharedNote.files[0].url" />
					</div>
				</div>
				<button class="share-note-btn" @click="shareNote">
					<i class="ti ti-send"></i>
					<span>{{ i18n.ts._quickBark.shareToStory || 'Share to story' }}</span>
				</button>
			</div>
		</div>

		<!-- Text editor modal -->
		<div v-if="showingTextEditor && !textStoryMode" class="text-editor-modal"
			@click.self="showingTextEditor = false">
			<div class="text-editor-content">
				<textarea v-model="content" :placeholder="i18n.ts.typeMessage || 'Type a message...'" autofocus
					maxlength="200"></textarea>
				<div class="char-count">{{ content.length }}/200</div>
				<button class="done-btn" @click="showingTextEditor = false">
					{{ i18n.ts.done || 'Done' }}
				</button>
			</div>
		</div>

		<!-- Color picker modal -->
		<div v-if="showColorPicker" class="color-picker-modal" @click.self="showColorPicker = false">
			<div class="color-picker-content">
				<div class="color-picker-header">
					<h3>{{ i18n.ts.chooseBackground || 'Choose Background' }}</h3>
					<button class="close-btn" @click="showColorPicker = false">
						<i class="ti ti-x"></i>
					</button>
				</div>
				<div class="color-grid">
					<button v-for="color in colorOptions" :key="color" class="color-option"
						:class="{ active: backgroundColor === color }" :style="{ background: color }"
						@click="selectColor(color)">
						<i v-if="backgroundColor === color" class="ti ti-check"></i>
					</button>
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { ref, onMounted, nextTick } from 'vue';
import * as os from '@/os';
import { i18n } from '@/i18n';

const props = defineProps<{
	sharedNoteId?: string;
}>();

const emit = defineEmits(['close', 'closed']);

const content = ref('');
const fileId = ref<string | null>(null);
const previewUrl = ref<string | null>(null);
const fileType = ref<'image' | 'video' | 'gif' | 'text'>('text');
const creating = ref(false);
const showingTextEditor = ref(false);
const showColorPicker = ref(false);
const backgroundColor = ref('#000000');
const textStoryMode = ref(false);
const textAlignment = ref<'left' | 'center' | 'right'>('center');
const drawMode = ref(false);
const drawCanvas = ref<HTMLCanvasElement | null>(null);
const isDrawing = ref(false);
const drawContext = ref<CanvasRenderingContext2D | null>(null);
const textOverlays = ref<Array<{ content: string; x: number; y: number; color: string; size: number }>>([]);
const sharedNote = ref<any>(null);

onMounted(async () => {
	if (props.sharedNoteId) {
		try {
			sharedNote.value = await os.api('notes/show', { noteId: props.sharedNoteId });
		} catch (error) {
			console.error('Failed to load shared note:', error);
		}
	}
});

const selectMedia = async () => {
	try {
		const file = await os.selectDriveFile(false);
		if (file) {
			fileId.value = file.id;
			previewUrl.value = file.url;

			// Determine file type
			if (file.type.startsWith('image/gif')) {
				fileType.value = 'gif';
			} else if (file.type.startsWith('image/')) {
				fileType.value = 'image';
			} else if (file.type.startsWith('video/')) {
				fileType.value = 'video';
			}
		}
	} catch (error) {
		console.error('Failed to select file:', error);
	}
};

const createTextStory = () => {
	fileType.value = 'text';
	textStoryMode.value = true;
	showingTextEditor.value = true;
};

const shareNote = async () => {
	if (!props.sharedNoteId) return;

	creating.value = true;
	try {
		await os.api('quick-barks/create', {
			sharedNoteId: props.sharedNoteId,
		});
		os.success();
		close();
	} catch (error) {
		console.error('Failed to share note:', error);
		os.alert({
			type: 'error',
			text: i18n.ts.error || 'An error occurred',
		});
	} finally {
		creating.value = false;
	}
};

const showTextEditor = () => {
	showingTextEditor.value = true;
};

const toggleTextAlignment = () => {
	const alignments: Array<'left' | 'center' | 'right'> = ['left', 'center', 'right'];
	const currentIndex = alignments.indexOf(textAlignment.value);
	textAlignment.value = alignments[(currentIndex + 1) % alignments.length];
};

const toggleDrawMode = async () => {
	drawMode.value = !drawMode.value;
	if (drawMode.value) {
		await nextTick();
		if (drawCanvas.value) {
			const canvas = drawCanvas.value;
			canvas.width = canvas.offsetWidth;
			canvas.height = canvas.offsetHeight;
			drawContext.value = canvas.getContext('2d');
			if (drawContext.value) {
				drawContext.value.strokeStyle = '#fff';
				drawContext.value.lineWidth = 3;
				drawContext.value.lineCap = 'round';
			}
		}
	}
};

const startDrawing = (e: MouseEvent | TouchEvent) => {
	if (!drawMode.value || !drawContext.value) return;
	isDrawing.value = true;
	const pos = getEventPosition(e);
	drawContext.value.beginPath();
	drawContext.value.moveTo(pos.x, pos.y);
};

const draw = (e: MouseEvent | TouchEvent) => {
	if (!isDrawing.value || !drawContext.value) return;
	const pos = getEventPosition(e);
	drawContext.value.lineTo(pos.x, pos.y);
	drawContext.value.stroke();
};

const stopDrawing = () => {
	isDrawing.value = false;
};

const getEventPosition = (e: MouseEvent | TouchEvent) => {
	if (!drawCanvas.value) return { x: 0, y: 0 };
	const rect = drawCanvas.value.getBoundingClientRect();
	if (e instanceof TouchEvent) {
		return {
			x: e.touches[0].clientX - rect.left,
			y: e.touches[0].clientY - rect.top
		};
	}
	return {
		x: e.clientX - rect.left,
		y: e.clientY - rect.top
	};
};

const addSticker = async () => {
	// TODO: Implement sticker picker
	os.alert({
		type: 'info',
		text: 'Sticker feature coming soon!'
	});
};

const showSettings = () => {
	// Placeholder for settings
	os.alert({
		type: 'info',
		text: 'Settings coming soon!'
	});
};

const selectBackgroundColor = () => {
	showColorPicker.value = true;
};

const colorOptions = [
	'#000000', // Black
	'#1a1a1a', // Dark Gray
	'#4A5568', // Gray
	'#EF4444', // Red
	'#F59E0B', // Orange
	'#10B981', // Green
	'#3B82F6', // Blue
	'#8B5CF6', // Purple
	'#EC4899', // Pink
	'#F97316', // Orange-Red
	'#14B8A6', // Teal
	'#6366F1', // Indigo
];

const selectColor = (color: string) => {
	backgroundColor.value = color;
	showColorPicker.value = false;
};

const clearFile = () => {
	fileId.value = null;
	previewUrl.value = null;
	fileType.value = 'text';
	content.value = '';
	textStoryMode.value = false;
};

const createBark = async () => {
	if (!fileId.value && !content.value) {
		os.alert({
			type: 'error',
			text: i18n.ts.pleaseEnterContent || 'Please enter some content',
		});
		return;
	}

	creating.value = true;
	try {
		await os.api('quick-barks/create', {
			content: content.value || null,
			fileId: fileId.value,
			sharedNoteId: props.sharedNoteId,
		});
		os.success();
		close();
	} catch (error) {
		console.error('Failed to create Quick Bark:', error);
		os.alert({
			type: 'error',
			text: i18n.ts.error || 'An error occurred',
		});
	} finally {
		creating.value = false;
	}
};

function close() {
	emit('close');
	emit('closed');
}
</script>

<style lang="scss" scoped>
.quick-bark-creator {
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background: #000;
	z-index: 10001;
	display: flex;
	flex-direction: column;

	// Common header styles
	.story-header, .camera-header {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: max(env(safe-area-inset-top), 12px) 16px 12px;
		z-index: 10;
		background: linear-gradient(to bottom, rgba(0, 0, 0, 0.6) 0%, transparent 100%);

		h3 {
			color: #fff;
			font-size: 16px;
			font-weight: 600;
			margin: 0;
		}

		.icon-btn {
			width: 36px;
			height: 36px;
			border-radius: 50%;
			background: rgba(0, 0, 0, 0.3);
			backdrop-filter: blur(10px);
			border: none;
			color: #fff;
			display: flex;
			align-items: center;
			justify-content: center;
			cursor: pointer;
			font-size: 20px;
			transition: all 0.2s ease;

			&:hover {
				background: rgba(0, 0, 0, 0.5);
				transform: scale(1.05);
			}

			&:active {
				transform: scale(0.95);
			}
		}

		.header-actions {
			display: flex;
			gap: 8px;
		}
	}

	// Text story mode
	.text-story-mode {
		width: 100%;
		height: 100%;
		position: relative;
		display: flex;
		flex-direction: column;
		transition: background 0.3s ease;

		.text-story-content {
			flex: 1;
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 80px 20px 100px;

			.text-story-input {
				width: 100%;
				max-width: 500px;
				background: transparent;
				border: none;
				color: #fff;
				font-size: clamp(24px, 8vw, 42px);
				font-weight: 700;
				text-align: center;
				resize: none;
				outline: none;
				line-height: 1.3;
				font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;

				&::placeholder {
					color: rgba(255, 255, 255, 0.4);
				}
			}
		}

		.story-footer {
			position: absolute;
			bottom: 0;
			left: 0;
			right: 0;
			padding: 16px;
			padding-bottom: max(env(safe-area-inset-bottom), 16px);
			background: linear-gradient(to top, rgba(0, 0, 0, 0.6) 0%, transparent 100%);
			display: flex;
			flex-direction: column;
			gap: 12px;

			.char-count {
				color: rgba(255, 255, 255, 0.6);
				font-size: 13px;
				text-align: center;
			}

			.send-btn {
				display: flex;
				align-items: center;
				justify-content: center;
				gap: 8px;
				padding: 14px 24px;
				background: #fff;
				color: #000;
				border: none;
				border-radius: 24px;
				font-size: 15px;
				font-weight: 600;
				cursor: pointer;
				transition: all 0.2s ease;

				&:hover:not(:disabled) {
					transform: scale(1.02);
					box-shadow: 0 4px 12px rgba(255, 255, 255, 0.3);
				}

				&:active:not(:disabled) {
					transform: scale(0.98);
				}

				&:disabled {
					opacity: 0.5;
					cursor: not-allowed;
				}

				i {
					font-size: 18px;
				}
			}
		}
	}

	// Preview mode
	.preview-mode {
		width: 100%;
		height: 100%;
		position: relative;
		display: flex;
		flex-direction: column;
		background: #000;

		.preview-content {
			flex: 1;
			position: relative;
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 60px 0 100px;

			.media-preview {
				max-width: 100%;
				max-height: 100%;
				object-fit: contain;
			}

			.draw-canvas {
				position: absolute;
				top: 0;
				left: 0;
				width: 100%;
				height: 100%;
				cursor: crosshair;
				touch-action: none;
			}

			.text-overlay-item {
				position: absolute;
				font-weight: 700;
				text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
				pointer-events: none;
				user-select: none;
			}
		}

		.story-footer {
			position: absolute;
			bottom: 0;
			left: 0;
			right: 0;
			padding: 16px;
			padding-bottom: max(env(safe-area-inset-bottom), 16px);
			background: linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, transparent 100%);
			display: flex;
			flex-direction: column;
			gap: 12px;

			.caption-input {
				width: 100%;
				padding: 12px 16px;
				background: rgba(255, 255, 255, 0.1);
				border: 1px solid rgba(255, 255, 255, 0.2);
				border-radius: 20px;
				color: #fff;
				font-size: 14px;
				outline: none;

				&::placeholder {
					color: rgba(255, 255, 255, 0.5);
				}

				&:focus {
					background: rgba(255, 255, 255, 0.15);
					border-color: rgba(255, 255, 255, 0.4);
				}
			}

			.send-btn {
				display: flex;
				align-items: center;
				justify-content: center;
				gap: 8px;
				padding: 14px 24px;
				background: #fff;
				color: #000;
				border: none;
				border-radius: 24px;
				font-size: 15px;
				font-weight: 600;
				cursor: pointer;
				transition: all 0.2s ease;

				&:hover:not(:disabled) {
					transform: scale(1.02);
					box-shadow: 0 4px 12px rgba(255, 255, 255, 0.3);
				}

				&:active:not(:disabled) {
					transform: scale(0.98);
				}

				&:disabled {
					opacity: 0.5;
					cursor: not-allowed;
				}

				i {
					font-size: 18px;
				}
			}
		}
	}

	// Camera mode (Instagram Stories style)
	.camera-mode {
		width: 100%;
		height: 100%;
		position: relative;
		display: flex;
		flex-direction: column;

		.camera-view {
			flex: 1;
			display: flex;
			align-items: center;
			justify-content: center;
			background: #1a1a1a;

			.camera-placeholder {
				text-align: center;
				color: rgba(255, 255, 255, 0.5);

				i {
					font-size: 64px;
					margin-bottom: 16px;
					opacity: 0.3;
				}

				p {
					font-size: 14px;
					max-width: 250px;
					margin: 0 auto;
					line-height: 1.5;
				}
			}
		}

		.camera-controls {
			display: flex;
			align-items: center;
			justify-content: space-around;
			padding: 24px 20px;
			padding-bottom: max(env(safe-area-inset-bottom, 24px), 24px);
			background: #000;

			.control-btn {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: 8px;
				background: none;
				border: none;
				color: #fff;
				cursor: pointer;
				transition: all 0.2s ease;

				&:active {
					transform: scale(0.9);
				}

				.btn-icon {
					width: 48px;
					height: 48px;
					border-radius: 12px;
					background: rgba(255, 255, 255, 0.1);
					display: flex;
					align-items: center;
					justify-content: center;
					font-size: 24px;
					transition: all 0.2s ease;
				}

				&:hover .btn-icon {
					background: rgba(255, 255, 255, 0.2);
				}

				&.capture-btn {
					.capture-circle {
						width: 72px;
						height: 72px;
						border-radius: 50%;
						border: 4px solid #fff;
						display: flex;
						align-items: center;
						justify-content: center;
						transition: all 0.2s ease;

						.capture-inner {
							width: 56px;
							height: 56px;
							border-radius: 50%;
							background: #fff;
							transition: all 0.2s ease;
						}
					}

					&:active .capture-circle {
						transform: scale(0.9);
					}
				}

				span {
					font-size: 12px;
					font-weight: 500;
					opacity: 0.8;
				}
			}
		}

		.share-note-banner {
			position: absolute;
			bottom: 160px;
			left: 16px;
			right: 16px;
			display: flex;
			flex-direction: column;
			gap: 12px;
			padding: 16px;
			background: rgba(255, 255, 255, 0.95);
			backdrop-filter: blur(10px);
			border-radius: 16px;
			color: #000;
			max-height: 60vh;
			overflow-y: auto;

			.banner-header {
				display: flex;
				align-items: center;
				gap: 10px;
				font-size: 14px;
				font-weight: 600;
				color: #666;

				i {
					font-size: 20px;
					color: #0084FF;
				}
			}

			.note-preview-card {
				background: #f5f5f5;
				border-radius: 12px;
				padding: 12px;
				
				.note-preview-header {
					display: flex;
					align-items: center;
					gap: 10px;
					margin-bottom: 10px;

					.preview-avatar {
						width: 32px;
						height: 32px;
						flex-shrink: 0;
					}

					.preview-user-info {
						flex: 1;
						min-width: 0;
						display: flex;
						flex-direction: column;
						gap: 2px;

						.preview-username {
							font-weight: 700;
							font-size: 14px;
							color: #000;
						}

						.preview-handle {
							font-size: 13px;
							color: #666;
						}
					}
				}

				.note-preview-text {
					font-size: 14px;
					line-height: 1.5;
					color: #000;
					word-wrap: break-word;
					display: -webkit-box;
					-webkit-line-clamp: 4;
					-webkit-box-orient: vertical;
					overflow: hidden;
				}

				.note-preview-media {
					margin-top: 10px;
					border-radius: 8px;
					overflow: hidden;
					max-height: 150px;

					img {
						width: 100%;
						height: auto;
						object-fit: cover;
						max-height: 150px;
					}
				}
			}

			.share-note-btn {
				display: flex;
				align-items: center;
				justify-content: center;
				gap: 8px;
				padding: 12px 20px;
				background: #0084FF;
				color: #fff;
				border: none;
				border-radius: 24px;
				font-size: 15px;
				font-weight: 600;
				cursor: pointer;
				transition: all 0.2s ease;

				i {
					font-size: 18px;
				}

				&:hover {
					background: #0073E6;
					transform: translateY(-1px);
					box-shadow: 0 4px 12px rgba(0, 132, 255, 0.3);
				}

				&:active {
					transform: scale(0.98);
				}
			}
		}
	}

	// Text editor modal
	.text-editor-modal {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.8);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 10002;

		.text-editor-content {
			width: 90%;
			max-width: 500px;
			padding: 24px;
			background: var(--panel);
			border-radius: 16px;
			display: flex;
			flex-direction: column;
			gap: 16px;

			textarea {
				width: 100%;
				height: 200px;
				padding: 16px;
				background: var(--bg);
				border: 1px solid var(--divider);
				border-radius: 8px;
				color: var(--fg);
				font-size: 16px;
				resize: none;
				outline: none;

				&:focus {
					border-color: var(--accent);
				}
			}

			.char-count {
				text-align: right;
				font-size: 12px;
				color: var(--fgTransparentWeak);
			}

			.done-btn {
				padding: 12px 24px;
				background: var(--accent);
				color: var(--fgOnAccent);
				border: none;
				border-radius: 8px;
				font-size: 16px;
				font-weight: 600;
				cursor: pointer;
				transition: background 0.2s ease;

				&:hover {
					background: var(--accentDarken);
				}
			}
		}
	}

	// Color picker modal
	.color-picker-modal {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.8);
		display: flex;
		align-items: flex-end;
		justify-content: center;
		z-index: 10002;

		.color-picker-content {
			width: 100%;
			max-width: 500px;
			padding: 24px;
			background: var(--panel);
			border-radius: 16px 16px 0 0;
			display: flex;
			flex-direction: column;
			gap: 20px;

			.color-picker-header {
				display: flex;
				justify-content: space-between;
				align-items: center;

				h3 {
					margin: 0;
					color: var(--fg);
					font-size: 18px;
					font-weight: 700;
				}

				.close-btn {
					width: 32px;
					height: 32px;
					border-radius: 50%;
					background: var(--buttonBg);
					border: none;
					color: var(--fg);
					display: flex;
					align-items: center;
					justify-content: center;
					cursor: pointer;
					font-size: 20px;
					transition: background 0.2s ease;

					&:hover {
						background: var(--buttonHoverBg);
					}
				}
			}

			.color-grid {
				display: grid;
				grid-template-columns: repeat(4, 1fr);
				gap: 12px;

				.color-option {
					aspect-ratio: 1;
					border-radius: 12px;
					border: 3px solid transparent;
					cursor: pointer;
					display: flex;
					align-items: center;
					justify-content: center;
					transition: all 0.2s ease;
					font-size: 24px;
					color: #fff;

					&:hover {
						transform: scale(1.1);
					}

					&.active {
						border-color: var(--accent);
						box-shadow: 0 0 0 4px var(--accentedBg);
					}

					i {
						text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
					}
				}
			}
		}
	}

	// Mobile optimizations
	@media (max-width: 768px) {
		.text-story-mode {
			.text-story-content {
				.text-story-input {
					font-size: 32px;
				}
			}
		}
		
		.camera-controls {
			.control-btn {
				.btn-icon {
					width: 44px;
					height: 44px;
					font-size: 22px;
				}

				&.capture-btn .capture-circle {
					width: 68px;
					height: 68px;

					.capture-inner {
						width: 52px;
						height: 52px;
					}
				}

				span {
					font-size: 11px;
				}
			}
		}
	}
}
</style>
