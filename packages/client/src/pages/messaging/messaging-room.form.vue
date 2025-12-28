<template>
	<div class="messaging-form" @dragover.stop="onDragover" @drop.stop="onDrop">
	  <div class="input-wrapper">
		<button class="circle-button upload-button" @click="chooseFile" title="Upload file">
		  <i class="ph-plus-circle-bold"></i>
		</button>
		<textarea
		  ref="textEl"
		  v-model="text"
		  :placeholder="i18n.ts.inputMessageHere"
		  @keydown="onKeydown"
		  @input="onInput"
		  @compositionstart="onCompositionStart"
		  @compositionend="onCompositionEnd"
		  @paste="onPaste"
		></textarea>
		<button class="circle-button emoji-button" @click="insertEmoji" title="Insert emoji">
		  <i class="ph-smiley-bold"></i>
		</button>
		<button class="circle-button gif-button" @click="pickGif" title="Insert GIF">
		  <i class="ph-gif-bold"></i>
		</button>
		<button 
		  class="circle-button send-button" 
		  :disabled="!canSend || sending" 
		  :title="i18n.ts.send" 
		  @click="send"
		  @touchstart.prevent="send"
		>
		  <i :class="sending ? 'ph-circle-notch-bold fa-spin' : 'ph-paper-plane-tilt-bold'"></i>
		</button>
	  </div>
	  <div v-if="file" class="file-preview" @click="file = null">
		{{ file.name }}
	  </div>
	  <input ref="fileEl" type="file" @change="onChangeFile" style="display: none;" />
	</div>
  </template>
  
  <script lang="ts" setup>
  import { ref, computed, onMounted, watch, nextTick } from 'vue';
  import * as Misskey from 'calckey-js';
  import autosize from 'autosize';
  import { throttle } from 'throttle-debounce';
  import { Autocomplete } from '@/scripts/autocomplete';
  import { formatTimeString } from '@/scripts/format-time-string';
  import { selectFile } from '@/scripts/select-file';
  import * as os from '@/os';
  import { stream } from '@/stream';
  import { defaultStore } from '@/store';
  import { i18n } from '@/i18n';
  import { uploadFile } from '@/scripts/upload';
  import { Keyboard, KeyboardResizeOptions } from '@capacitor/keyboard';
  
  const props = defineProps<{
	user?: Misskey.entities.UserDetailed | null;
	group?: Misskey.entities.UserGroup | null;
  }>();
  
  const textEl = ref<HTMLTextAreaElement | null>(null);
  const fileEl = ref<HTMLInputElement | null>(null);
  
  const text = ref('');
  const file = ref<Misskey.entities.DriveFile | null>(null);
  const sending = ref(false);
  const isComposing = ref(false);
  
  const typing = throttle(3000, () => {
	stream.send('typingOnMessaging', props.user ? { partner: props.user.id } : { group: props.group?.id });
  });
  
  const draftKey = computed(() => props.user ? 'user:' + props.user.id : 'group:' + props.group?.id);
  const canSend = computed(() => (text.value != null && text.value !== '') || file.value != null);
  
  watch([text, file], saveDraft);
  
  function onPaste(ev: ClipboardEvent) {
	if (!ev.clipboardData) return;
  
	const clipboardData = ev.clipboardData;
	const items = clipboardData.items;
  
	if (items.length === 1) {
	  if (items[0].kind === 'file') {
		const pastedFile = items[0].getAsFile();
		if (!pastedFile) return;
		const lio = pastedFile.name.lastIndexOf('.');
		const ext = lio >= 0 ? pastedFile.name.slice(lio) : '';
		const formatted = formatTimeString(new Date(pastedFile.lastModified), defaultStore.state.pastedFileName).replace(/{{number}}/g, '1') + ext;
		if (formatted) upload(pastedFile, formatted);
	  }
	} else {
	  if (items[0].kind === 'file') {
		os.alert({
		  type: 'error',
		  text: i18n.ts.onlyOneFileCanBeAttached,
		});
	  }
	}
  }
  
  function onDragover(ev: DragEvent) {
	if (!ev.dataTransfer) return;
  
	const isFile = ev.dataTransfer.items[0].kind === 'file';
	const isDriveFile = ev.dataTransfer.types[0] === _DATA_TRANSFER_DRIVE_FILE_;
	if (isFile || isDriveFile) {
	  ev.preventDefault();
	  ev.dataTransfer.dropEffect = ev.dataTransfer.effectAllowed === 'all' ? 'copy' : 'move';
	}
  }
  
  function onDrop(ev: DragEvent): void {
	if (!ev.dataTransfer) return;
  
	if (ev.dataTransfer.files.length === 1) {
	  ev.preventDefault();
	  upload(ev.dataTransfer.files[0]);
	  return;
	} else if (ev.dataTransfer.files.length > 1) {
	  ev.preventDefault();
	  os.alert({
		type: 'error',
		text: i18n.ts.onlyOneFileCanBeAttached,
	  });
	  return;
	}
  
	const driveFile = ev.dataTransfer.getData(_DATA_TRANSFER_DRIVE_FILE_);
	if (driveFile != null && driveFile !== '') {
	  file.value = JSON.parse(driveFile);
	  ev.preventDefault();
	}
  }
  
  function onInput() {
	if (!isComposing.value) {
	  typing();
	}
  }
  
  function onCompositionStart() {
	isComposing.value = true;
  }
  
  function onCompositionEnd() {
	isComposing.value = false;
	typing();
  }
  
  function onKeydown(ev: KeyboardEvent) {
	typing();
	let sendOnEnter = localStorage.getItem('enterSendsMessage') === 'true' || defaultStore.state.enterSendsMessage;
	if (sendOnEnter) {
	  if ((ev.key === 'Enter') && (ev.ctrlKey || ev.metaKey)) {
		if (textEl.value) {
		  const cursorPosition = textEl.value.selectionStart;
		  text.value = text.value.slice(0, cursorPosition) + '\n' + text.value.slice(cursorPosition);
		  nextTick(() => {
			if (textEl.value) {
			  textEl.value.selectionStart = textEl.value.selectionEnd = cursorPosition + 1;
			}
		  });
		}
	  }
	  else if (ev.key === 'Enter' && !ev.shiftKey && !('ontouchstart' in document.documentElement) && canSend.value) {
		ev.preventDefault();
		send();
	  }
	}
	else {
	  if ((ev.key === 'Enter') && (ev.ctrlKey || ev.metaKey) && canSend.value) {
		ev.preventDefault();
		send();
	  }
	}
  }
  
  function chooseFile(ev: MouseEvent) {
	selectFile(ev.currentTarget ?? ev.target, i18n.ts.selectFile).then(selectedFile => {
	  file.value = selectedFile;
	});
  }
  
  function onChangeFile() {
	if (fileEl.value && fileEl.value.files && fileEl.value.files[0]) {
	  upload(fileEl.value.files[0]);
	}
  }
  
  function upload(fileToUpload: File, name?: string) {
	uploadFile(fileToUpload, defaultStore.state.uploadFolder, name).then(res => {
	  file.value = res;
	});
  }
  
  function send() {
	sending.value = true;
	os.api('messaging/messages/create', {
	  userId: props.user ? props.user.id : undefined,
	  groupId: props.group ? props.group.id : undefined,
	  text: text.value ? text.value : undefined,
	  fileId: file.value ? file.value.id : undefined,
	}).then(message => {
	  clear();
	  nextTick(() => {
		if (textEl.value) {
		  textEl.value.value = '';
		  textEl.value.style.height = 'auto';
		  focus();
		  autosize.update(textEl.value);
		}
	  });
	}).catch(err => {
	  console.error(err);
	}).finally(() => {
	  sending.value = false;
	});
  }
  
  function clear() {
	text.value = '';
	file.value = null;
	deleteDraft();
  }
  
  function saveDraft() {
	const drafts = JSON.parse(localStorage.getItem('message_drafts') || '{}');
  
	drafts[draftKey.value] = {
	  updatedAt: new Date(),
	  data: {
		text: text.value,
		file: file.value,
	  },
	};
  
	localStorage.setItem('message_drafts', JSON.stringify(drafts));
  }
  
  function deleteDraft() {
	const drafts = JSON.parse(localStorage.getItem('message_drafts') || '{}');
  
	delete drafts[draftKey.value];
  
	localStorage.setItem('message_drafts', JSON.stringify(drafts));
  }
  
  async function insertEmoji(ev: MouseEvent) {
	os.openEmojiPicker(ev.currentTarget ?? ev.target, {}, textEl.value);
  }
  
  function pickGif(ev: MouseEvent) {
	os.openGifPicker(ev.currentTarget ?? ev.target, {}, (driveFile) => {
	  if (driveFile && driveFile.id) {
		file.value = driveFile;
		console.log('GIF selected:', driveFile);
	  }
	});
  }
  
  function focus() { 
	if (textEl.value) {
	  textEl.value.focus();
	  textEl.value.setSelectionRange(0, 0);
	}
  }
  
  onMounted(() => {
	if (textEl.value) {
	  autosize(textEl.value);
	}
  
	focus();
  
	nextTick(() => {
	  focus();
	});
  
	if (textEl.value) {
	  new Autocomplete(textEl.value, text);
	}
  
	const draft = JSON.parse(localStorage.getItem('message_drafts') || '{}')[draftKey.value];
	if (draft) {
	  text.value = draft.data.text;
	  file.value = draft.data.file;
	}
  });
  
  defineExpose({
	file,
	upload,
  });
  
  const options: KeyboardResizeOptions = { mode: 'native' };
  Keyboard.setResizeMode(options);
  </script>
  
  <style lang="scss" scoped>
  .messaging-form {
	border-radius: 20px;
	padding: 8px;
	margin-top: 0px;
	overflow-y: hidden;
  
	.input-wrapper {
	  display: flex;
	  align-items: center;
	  border-radius: 20px;
	  padding: 6px;
	}
  
	textarea {
	  flex-grow: 1;
	  border: none;
	  background: transparent;
	  resize: none;
	  min-height: 20px;
	  max-height: 200px;
	  font-size: 14px;
	  line-height: 20px;
	  color: var(--fg);
	  outline: none;
	  padding: 6px 8px;
	  margin: 0 4px;
  
	  &::placeholder {
		color: var(--fgTransparentWeak);
	  }
	}
  
	.circle-button {
	  width: 32px;
	  height: 32px;
	  border-radius: 50%;
	  display: flex;
	  align-items: center;
	  justify-content: center;
	  border: none;
	  cursor: pointer;
	  transition: background 0.2s ease, color 0.2s ease;
	  flex-shrink: 0;
  
	  i {
		font-size: 18px;
	  }
	}
  
	.upload-button, .emoji-button, .gif-button {
	  background: transparent;
	  color: var(--fgTransparentWeak);
  
	  &:hover {
		background: var(--bgTransparentWeak);
		color: var(--accent);
	  }
	}
  
	.send-button {
	  background: var(--accent);
	  color: white;
  
	  &:disabled {
		background: var(--bgTransparentWeak);
		color: var(--fgTransparentWeak);
		cursor: not-allowed;
	  }
  
	  &:not(:disabled):hover {
		background: var(--accentLighten);
	  }
	}
  
	.file-preview {
	  background: var(--bg);
	  border-radius: 4px;
	  padding: 4px 8px;
	  font-size: 12px;
	  margin-top: 8px;
	  cursor: pointer;
	  display: inline-block;
	}
  }
  </style>