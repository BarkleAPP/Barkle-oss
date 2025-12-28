<template>
	<div class="mk-live-fullscreen">
		<!-- Full-screen toggle button -->
		<button v-if="streamData?.isActive" class="fullscreen-toggle" @click="toggleFullscreen">
			<i class="ph-arrows-out-bold" v-if="!isFullscreen"></i>
			<i class="ph-arrows-in-bold" v-else></i>
		</button>

		<MkStickyContainer>
			<template #header>
				<MkPageHeader
					:actions="headerActions"
					:tabs="headerTabs"
					class="live-header"
					v-if="!isFullscreen"
				/>
			</template>

			<div class="mk-live-container" :class="{ fullscreen: isFullscreen }">
				<div class="content-wrapper" :class="{ fullscreen: isFullscreen }">
					<!-- Stream Section -->
					<div class="stream-section" :class="{ fullscreen: isFullscreen }">
						<div v-if="user" class="player-container" :class="{ fullscreen: isFullscreen }">
							<mux-player
								v-if="streamData?.isActive"
								:playback-id="streamData.playbackId"
								stream-type="live"
								:metadata-video-title="streamTitle"
								:metadata-viewer-user-id="user.id"
								class="mux-player"
								:class="{ fullscreen: isFullscreen }"
								primary-color="var(--accent)"
								default-hidden-captions
								target-live-window="1"
								stream-latency-mode="low"
								live-edge-tolerance="0.5"
								max-resolution="1080p"
							/>
							<div v-else class="offline-message">
								<div class="offline-content">
									<i class="ph-broadcast-bold ph-lg"></i>
									<span>{{ i18n.ts.streamOffline }}</span>
									<div class="offline-subtitle">{{ i18n.t('streamNotCurrentlyActive', { username: user.name || '@' + user.username }) }}</div>
								</div>
							</div>

							<!-- Stream overlay info -->
							<div v-if="streamData?.isActive && !isFullscreen" class="stream-overlay">
								<div class="stream-info">
									<div class="viewers">
										<i class="ph-eye-bold"></i>
										<span>{{ streamData.viewers }}</span>
									</div>
								</div>							<div class="live-indicator">
								<div class="live-dot"></div>
								<span>{{ i18n.ts.live ?? 'LIVE' }}</span>
							</div>
							</div>

							<!-- Fullscreen overlay -->
							<div v-if="streamData?.isActive && isFullscreen" class="fullscreen-overlay">
								<div class="fullscreen-info">
									<div class="stream-title">{{ streamTitle }}</div>
									<div class="stream-stats">
										<div class="viewers">
											<i class="ph-eye-bold"></i>
											<span>{{ streamData.viewers }}</span>
										</div>
										<div class="live-badge">
											<div class="live-dot"></div>
											<span>{{ i18n.ts.live }}</span>
										</div>
									</div>
								</div>
							</div>
						</div>
						<MkError v-else-if="error" @retry="fetchUser()"/>
						<MkLoading v-else/>

						<div v-if="user && streamData?.isActive && !isFullscreen" class="stream-details">
							<div class="streamer-info">
								<MkAvatar :user="user" class="avatar" :show-indicator="true"/>
								<div class="text-content">
									<div class="name">{{ user.name || '@' + user.username }}</div>
									<div class="username" v-if="user.name">@{{ user.username }}</div>
									<div class="stream-title-detail">{{ streamTitle }}</div>
								</div>
								<div class="stream-actions">
									<MkFollowButton 
										v-if="user.id !== $i?.id" 
										:user="user" 
										:full="true" 
										class="action-btn follow-btn"
									/>
									<button class="action-btn share-btn" @click="shareStream">
										<i class="ph-share-bold"></i>
										{{ i18n.ts.share }}
									</button>
								</div>
							</div>
						</div>
					</div>

					<!-- Chat Section -->
					<div class="chat-section" v-if="!isFullscreen" :class="{ 'mobile-overlay': isMobileChat }">
						<div class="chat-header">
							<h3>{{ i18n.ts.liveChat }}</h3>
							<button class="chat-toggle" @click="toggleMobileChat">
								<i class="ph-chat-dots-bold"></i>
							</button>
						</div>
						<div ref="rootEl" class="chat-container">
							<div class="messages-container" ref="messagesContainer">
								<div v-if="messages.length > 0" class="messages">
									<LiveChatMessage 
										v-for="message in messages" 
										:key="message.id" 
										:message="message"
										:is-mod="isModerator"
										@delete="onMessageDelete"
									/>
								</div>
								<div v-else class="no-messages">
									<i class="ph-chat-dots-bold ph-lg"></i>
									<div>{{ i18n.ts.noMessagesYet }}</div>
									<div class="no-messages-subtitle">{{ i18n.ts.beTheFirstToChat }}</div>
								</div>
							</div>

							<footer>
								<LiveChatForm 
									ref="formEl" 
									:disabled="!streamData?.isActive"
									:stream-id="streamData?.id"
									@submit="onChatSubmit"
								/>
							</footer>
						</div>
					</div>
				</div>
			</div>
		</MkStickyContainer>
	</div>
</template>
  
  <script lang="ts" setup>
  import { computed, ref, onMounted, onUnmounted, nextTick, watch, defineAsyncComponent } from 'vue';
  import '@mux/mux-player';
  import * as Acct from 'calckey-js/built/acct';
  import * as os from '@/os';
  import * as Misskey from 'calckey-js';
  import { stream } from '@/stream';
  import { i18n } from '@/i18n';
  import { definePageMetadata } from '@/scripts/page-metadata';
  import { $i } from '@/account';
  import MkFollowButton from '@/components/MkFollowButton.vue';
  import LiveChatMessage from './LiveChatMessage.vue';
  import LiveChatForm from './LiveChatForm.vue';
  
  const props = withDefaults(
	defineProps<{
	  acct: string;
	}>(),
	{},
  );
  
  // Stream related refs
  const user = ref<null | Misskey.entities.UserDetailed>(null);
  const error = ref(null);
  const streamData = ref<{
	id: string;
	isActive: boolean;
	viewers: number;
	url: string;
	noteId: string;
	playbackId: string;
  } | null>(null);
  
  // UI state refs
  const isFullscreen = ref(false);
  const isMobileChat = ref(false);
  
  // Chat related refs
  const rootEl = ref<HTMLDivElement>();
  const messagesContainer = ref<HTMLDivElement>();
  const formEl = ref<InstanceType<typeof LiveChatForm>>();
  const fetching = ref(true);
  const messages = ref<any[]>([]);
  const connection = ref<Misskey.ChannelConnection<any> | null>(null);
  const viewerConnection = ref<Misskey.ChannelConnection<any> | null>(null);
  const viewerConnections = ref<Misskey.ChannelConnection<any>[]>([]);
  const streamModerators = ref<any[]>([]);
  
  // Computed
  const headerActions = computed(() => [
	...(streamData.value?.isActive ? [{
	  icon: 'ph-arrows-out-bold',
	  text: isFullscreen.value ? i18n.ts.exitFullscreen : i18n.ts.fullscreen,
	  handler: toggleFullscreen,
	}, {
	  icon: 'ph-share-bold',
	  text: i18n.ts.share,
	  handler: shareStream,
	}] : []),
	...(isStreamOwner.value ? [{
	  icon: 'ph-shield-bold',
	  text: 'Manage Moderators',
	  handler: openModerationDialog,
	}] : [])
  ]);
  const headerTabs = computed(() => null);
  const streamTitle = computed(() => 
	user.value
	  ? user.value.name
		? `${user.value.name}'s Stream`
		: `@${user.value.username}'s Stream`
	  : 'Live Stream'
  );
  
  const isModerator = computed(() => {
	// Check if user is stream owner, site moderator, or stream moderator
	const isOwner = user.value?.id === $i?.id;
	const isSiteMod = $i?.isModerator || $i?.isAdmin || false;
	const isStreamMod = streamModerators.value.some(mod => mod.userId === $i?.id);
	
	return isOwner || isSiteMod || isStreamMod;
  });
  
  const isStreamOwner = computed(() => 
	user.value?.id === $i?.id
  );
  
  // Stream methods
  async function fetchStream() {
	try {
	  if (!user.value?.id) return;
	  console.log('Fetching stream for user:', user.value.id);
	  const response = await os.api('live/get', {
		userId: user.value.id
	  });
	  console.log('Stream response:', response);
	  streamData.value = response;
	  
	  // Set up live chat when we have stream data
	  if (response) {
		console.log('Setting up live chat stream...');
		setupLiveChatStream();
		setupViewerStream();
		fetchInitialMessages();
		// Fetch moderators if user is stream owner
		if (isStreamOwner.value && response.id) {
		  fetchStreamModerators(response.id);
		}
	  } else {
		// If no stream data, still set fetching to false
		fetching.value = false;
	  }
	} catch (err) {
	  console.error('Failed to fetch stream:', err);
	  streamData.value = null;
	  fetching.value = false;
	}
  }
  
  async function fetchStreamModerators(streamId: string) {
	try {
	  const mods = await os.api('live/moderators/list', { streamId });
	  streamModerators.value = mods;
	} catch (err) {
	  console.error('Failed to fetch stream moderators:', err);
	}
  }
  
  async function fetchUser(): Promise<void> {
	console.log('fetchUser called with acct:', props.acct);
	if (props.acct == null) return;
	user.value = null;
	try {
	  const parsed = Acct.parse(props.acct);
	  console.log('Parsed acct:', parsed);
	  const u = await os.api('users/show', {
		username: parsed.username,
		host: parsed.host || undefined
	  });
	  user.value = u;
	  await fetchStream();
	} catch (err) {
	  console.error('fetchUser error:', err);
	  error.value = err as any;
	}
  }
  
  watch(() => props.acct, fetchUser, {
	immediate: true,
  });
  
  // Chat methods
  async function fetchInitialMessages() {
	if (!streamData.value?.id) return;
	
	try {
	  const liveChatMessages = await os.api('live-chat/messages', {
		streamId: streamData.value.id,
		limit: 30,
	  });
	  messages.value = liveChatMessages.reverse();
	  nextTick(() => {
		scrollToBottom();
	  });
	} catch (err) {
	  console.error('Failed to fetch messages:', err);
	}
	
	fetching.value = false;
  }
  
  function setupLiveChatStream() {
	// Clean up existing connection if any
	if (connection.value) {
	  connection.value.dispose();
	}

	if (!streamData.value?.id) {
	  console.log('No stream ID available for chat setup');
	  return;
	}
  
	try {
	  // Subscribe to live chat stream
	  connection.value = stream.useChannel('streamChat', { streamId: streamData.value.id });
	  
	  // Listen for new messages
	  connection.value.on('message', (message) => {
		messages.value.push(message);
		nextTick(() => {
		  scrollToBottom();
		});
	  });
  
	  // Listen for deleted messages
	  connection.value.on('deleted', (deletedInfo) => {
		messages.value = messages.value.filter(m => m.id !== deletedInfo.messageId);
	  });
	} catch (error) {
	  console.error('Failed to setup live chat stream:', error);
	}
  }
  
  function setupViewerStream() {
	// Clean up existing viewer connection if any
	if (viewerConnection.value) {
	  viewerConnection.value.dispose();
	}
  
	if (!streamData.value?.id) return;
  
	try {
	  // Subscribe to viewer updates stream
	  console.log('Setting up viewer stream for stream ID:', streamData.value.id);
	  viewerConnection.value = stream.useChannel('streamViewers', { streamId: streamData.value.id });
	  
	  // Listen for viewer updates
	  viewerConnection.value.on('viewerUpdate', (viewerData) => {
		console.log('Received viewer update:', viewerData);
		if (streamData.value) {
		  console.log(`Updating viewer count from ${streamData.value.viewers} to ${viewerData.viewers}`);
		  streamData.value.viewers = viewerData.viewers;
		}
	  });

	  // Also connect to the viewing tracker if user is authenticated
	  if ($i) {
		// Subscribe to stream viewing channel to track this user as a viewer
		console.log('Setting up viewing tracker for authenticated user:', $i.id);
		const viewingTracker = stream.useChannel('streamViewing', { streamId: streamData.value.id });
		// Store reference to clean up later
		if (!viewerConnections.value) {
		  viewerConnections.value = [];
		}
		viewerConnections.value.push(viewingTracker);
	  }
	} catch (error) {
	  console.error('Failed to setup viewer stream:', error);
	}
  }
  
  function onMessageDelete(messageId: string) {
	if (!isModerator.value) return;
	os.api('live-chat/delete', {
	  messageId: messageId,
	});
  }
  
  function onChatSubmit(text: string) {
	console.log('onChatSubmit called with text:', text);
	nextTick(() => {
	  scrollToBottom();
	});
  }
  
  function scrollToBottom() {
	if (!messagesContainer.value) return;
	messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
  
  // UI functions
  function toggleFullscreen() {
	isFullscreen.value = !isFullscreen.value;
	if (isFullscreen.value) {
	  document.documentElement.requestFullscreen?.();
	} else {
	  document.exitFullscreen?.();
	}
  }
  
  function toggleMobileChat() {
	isMobileChat.value = !isMobileChat.value;
  }
  
  function shareStream() {
	if (!user.value) return;
	const url = `${location.origin}/@${user.value.username}/live`;
	
	if (navigator.share) {
	  navigator.share({
		title: streamTitle.value,
		url: url,
	  }).catch(err => {
		console.log('Share cancelled or failed:', err);
		// Fallback to clipboard
		navigator.clipboard?.writeText(url);
	  });
	} else if (navigator.clipboard) {
	  navigator.clipboard.writeText(url).then(() => {
		// Could show a toast here
		console.log('Stream URL copied to clipboard');
	  }).catch(err => {
		console.error('Failed to copy to clipboard:', err);
	  });
	} else {
	  // Ultimate fallback - just log the URL
	  console.log('Stream URL:', url);
	}
  }
  
  function openModerationDialog() {
	// Open a dialog to manage stream moderators
	os.popup(defineAsyncComponent(() => import('@/components/MkStreamModerationDialog.vue')), {
	  streamId: streamData.value?.id,
	  moderators: streamModerators.value,
	}, {
	  done: (result) => {
		if (result?.updated && streamData.value?.id) {
		  fetchStreamModerators(streamData.value.id);
		}
	  },
	});
  }
  
  // Lifecycle
  let pollInterval: ReturnType<typeof setInterval>;
  
  onMounted(() => {
	fetchUser();
	pollInterval = setInterval(fetchStream, 30000);
  });
  
  onUnmounted(() => {
	if (pollInterval) clearInterval(pollInterval);
	if (connection.value) connection.value.dispose();
	if (viewerConnection.value) viewerConnection.value.dispose();
	
	// Clean up all viewer connections
	if (viewerConnections.value) {
	  viewerConnections.value.forEach(conn => {
		try {
		  conn.dispose();
		} catch (error) {
		  console.error('Error disposing viewer connection:', error);
		}
	  });
	  viewerConnections.value = [];
	}
  });
  
  definePageMetadata(computed(() =>
	user.value
	  ? {
		  icon: 'ph-broadcast-bold ph-lg',
		  title: streamTitle.value,
		  path: `/@${user.value.username}/live`,
		  bg: streamData.value?.isActive ? 'var(--accent)' : undefined,
		}
	  : {
		  icon: 'ph-broadcast-bold ph-lg',
		  title: 'Live Stream',
		}
  ));
  </script>
  
  <style lang="scss" scoped>
  .mk-live-fullscreen {
	position: relative;
	min-height: 100vh;
	background: var(--bg);
  }
  
  .fullscreen-toggle {
	position: fixed;
	top: 1rem;
	right: 1rem;
	z-index: 100;
	padding: 0.75rem;
	background: rgba(0, 0, 0, 0.8);
	color: white;
	border: none;
	border-radius: 50%;
	cursor: pointer;
	backdrop-filter: blur(10px);
	transition: all 0.3s ease;
	
	&:hover {
	  background: rgba(0, 0, 0, 0.9);
	  transform: scale(1.1);
	}
	
	i {
	  font-size: 1.2rem;
	}
  }
  
  .mk-live-container {
	padding: var(--margin);
	max-width: 1800px;
	margin: 0 auto;
	width: 100%;
	box-sizing: border-box;
	
	&.fullscreen {
	  padding: 0;
	  max-width: none;
	  height: 100vh;
	}
  
	@media (max-width: 500px) {
	  padding: calc(var(--margin) / 2);
	}
  }
  
  .content-wrapper {
	display: grid;
	grid-template-columns: 1fr 380px;
	gap: 1.5rem;
	height: 100%;
	
	&.fullscreen {
	  grid-template-columns: 1fr;
	  gap: 0;
	}
  
	@media (max-width: 1200px) {
	  grid-template-columns: 1fr;
	}
  }
  
  .stream-section {
	display: flex;
	flex-direction: column;
	
	&.fullscreen {
	  height: 100vh;
	}
	
	.player-container {
	  position: relative;
	  background: #000;
	  border-radius: 16px;
	  overflow: hidden;
	  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
	  
	  &.fullscreen {
		border-radius: 0;
		height: 100vh;
		box-shadow: none;
	  }
	}
  
	.mux-player {
	  width: 100%;
	  aspect-ratio: 16/9;
	  
	  &.fullscreen {
		height: 100vh;
		aspect-ratio: unset;
	  }
  
	  :deep(video) {
		object-fit: contain;
	  }
	}
	
	.stream-overlay {
	  position: absolute;
	  top: 1rem;
	  right: 1rem;
	  display: flex;
	  gap: 0.5rem;
	  z-index: 10;
	}
  
	.stream-info {
	  padding: 0.5rem 0.75rem;
	  background: rgba(0, 0, 0, 0.8);
	  border-radius: 999px;
	  color: #fff;
	  font-size: 0.9rem;
	  backdrop-filter: blur(10px);
	  border: 1px solid rgba(255, 255, 255, 0.1);
  
	  .viewers {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-weight: 600;
	  }
	}
	
	.live-indicator {
	  padding: 0.5rem 0.75rem;
	  background: rgba(239, 68, 68, 0.9);
	  border-radius: 999px;
	  color: #fff;
	  font-size: 0.8rem;
	  font-weight: bold;
	  backdrop-filter: blur(10px);
	  display: flex;
	  align-items: center;
	  gap: 0.5rem;
	  animation: pulse 2s infinite;
	  
	  .live-dot {
		width: 8px;
		height: 8px;
		background: #fff;
		border-radius: 50%;
		animation: blink 1s infinite;
	  }
	}
	
	.fullscreen-overlay {
	  position: absolute;
	  bottom: 2rem;
	  left: 2rem;
	  right: 2rem;
	  background: rgba(0, 0, 0, 0.8);
	  backdrop-filter: blur(20px);
	  border-radius: 16px;
	  padding: 1.5rem;
	  color: white;
	  z-index: 10;
	  
	  .fullscreen-info {
		display: flex;
		justify-content: space-between;
		align-items: center;
		
		.stream-title {
		  font-size: 1.5rem;
		  font-weight: bold;
		}
		
		.stream-stats {
		  display: flex;
		  gap: 1rem;
		  align-items: center;
		  
		  .viewers {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			font-size: 1.1rem;
			font-weight: 600;
		  }
		  
		  .live-badge {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			padding: 0.5rem 1rem;
			background: rgba(239, 68, 68, 0.9);
			border-radius: 999px;
			font-weight: bold;
			
			.live-dot {
			  width: 10px;
			  height: 10px;
			  background: #fff;
			  border-radius: 50%;
			  animation: blink 1s infinite;
			}
		  }
		}
	  }
	}
  
	.offline-message {
	  width: 100%;
	  aspect-ratio: 16/9;
	  display: flex;
	  align-items: center;
	  justify-content: center;
	  background: linear-gradient(135deg, var(--panel) 0%, var(--bg) 100%);
	  color: var(--fg);
	  
	  .offline-content {
		text-align: center;
		
		i {
		  font-size: 4rem;
		  opacity: 0.5;
		  display: block;
		  margin-bottom: 1rem;
		}
  
		span {
		  font-size: 1.5rem;
		  font-weight: 600;
		  opacity: 0.8;
		  display: block;
		  margin-bottom: 0.5rem;
		}
		
		.offline-subtitle {
		  font-size: 1rem;
		  opacity: 0.6;
		}
	  }
	}
  
	.stream-details {
	  background: var(--panel);
	  border-radius: 16px;
	  padding: 1.5rem;
	  margin-top: 1.5rem;
	  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  
	  .streamer-info {
		display: flex;
		align-items: center;
		gap: 1rem;
  
		.avatar {
		  width: 56px;
		  height: 56px;
		  border: 3px solid var(--accent);
		  border-radius: 50%;
		}
  
		.text-content {
		  flex-grow: 1;
		  
		  .name {
			font-weight: bold;
			font-size: 1.2rem;
			line-height: 1.3;
			color: var(--accent);
		  }
  
		  .username {
			opacity: 0.7;
			font-size: 0.9rem;
			line-height: 1.3;
			margin-bottom: 0.25rem;
		  }
		  
		  .stream-title-detail {
			font-size: 1rem;
			opacity: 0.8;
		  }
		}
		
		.stream-actions {
		  display: flex;
		  gap: 0.75rem;
		  
		  .action-btn {
			padding: 0.75rem 1rem;
			border: none;
			border-radius: 12px;
			font-weight: 600;
			cursor: pointer;
			transition: all 0.3s ease;
			display: flex;
			align-items: center;
			gap: 0.5rem;
			font-size: 0.9rem;
			
			&.follow-btn {
			  background: var(--accent);
			  color: var(--accentForeground);
			  
			  &:hover {
				background: var(--accentDarken);
				transform: translateY(-2px);
			  }
			}
			
			&.share-btn {
			  background: var(--buttonBg);
			  color: var(--fg);
			  
			  &:hover {
				background: var(--buttonHoverBg);
				transform: translateY(-2px);
			  }
			}
		  }
		}
	  }
	}
  }
  
  .chat-section {
	height: calc(100vh - 200px);
	background: var(--panel);
	border-radius: 16px;
	display: flex;
	flex-direction: column;
	box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
	overflow: hidden;
  
	@media (max-width: 1200px) {
	  height: 600px;
	  margin-top: 1.5rem;
	}
	
	&.mobile-overlay {
	  position: fixed;
	  top: 50%;
	  left: 50%;
	  transform: translate(-50%, -50%);
	  width: 90vw;
	  max-width: 400px;
	  height: 80vh;
	  z-index: 1000;
	  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
	}
	
	.chat-header {
	  padding: 1rem 1.5rem;
	  border-bottom: 1px solid var(--divider);
	  display: flex;
	  align-items: center;
	  justify-content: space-between;
	  background: var(--accentedBg);
	  
	  h3 {
		margin: 0;
		font-size: 1.1rem;
		font-weight: bold;
		color: var(--accent);
	  }
	  
	  .chat-toggle {
		padding: 0.5rem;
		background: none;
		border: none;
		color: var(--fg);
		cursor: pointer;
		border-radius: 8px;
		
		&:hover {
		  background: var(--buttonHoverBg);
		}
	  }
	}
  
	.chat-container {
	  display: flex;
	  flex-direction: column;
	  height: 100%;
	  overflow: hidden;
	}
  
	.messages-container {
	  flex-grow: 1;
	  overflow-y: auto;
	  padding: 1rem;
	  
	  &::-webkit-scrollbar {
		width: 6px;
	  }
	  
	  &::-webkit-scrollbar-track {
		background: transparent;
	  }
	  
	  &::-webkit-scrollbar-thumb {
		background: var(--scrollbarHandle);
		border-radius: 3px;
	  }
	}
  
	.messages {
	  display: flex;
	  flex-direction: column;
	  gap: 0.75rem;
	}
  
	.no-messages {
	  height: 100%;
	  display: flex;
	  flex-direction: column;
	  align-items: center;
	  justify-content: center;
	  opacity: 0.7;
	  gap: 1rem;
	  text-align: center;
  
	  i {
		font-size: 3rem;
		color: var(--accent);
		opacity: 0.5;
	  }
	  
	  .no-messages-subtitle {
		font-size: 0.9rem;
		opacity: 0.6;
	  }
	}
  
	footer {
	  border-top: 1px solid var(--divider);
	  padding: 1rem;
	  background: var(--bg);
	}
  }
  
  @keyframes pulse {
	0%, 100% { opacity: 1; }
	50% { opacity: 0.7; }
  }
  
  @keyframes blink {
	0%, 50% { opacity: 1; }
	51%, 100% { opacity: 0.3; }
  }
  
  // Mobile responsive improvements
  @media (max-width: 768px) {
	.mk-live-container {
	  padding: 0.5rem;
	}
	
	.content-wrapper {
	  gap: 1rem;
	}
	
	.stream-section {
	  .player-container {
		border-radius: 12px;
	  }
	  
	  .stream-details {
		padding: 1rem;
		margin-top: 1rem;
		
		.streamer-info {
		  flex-direction: column;
		  align-items: flex-start;
		  gap: 1rem;
		  
		  .stream-actions {
			align-self: stretch;
			
			.action-btn {
			  flex: 1;
			  justify-content: center;
			}
		  }
		}
	  }
	}
	
	.chat-section {
	  height: 400px;
	  
	  .chat-header {
		padding: 0.75rem 1rem;
	  }
	}
  }
  
  @media (max-width: 480px) {
	.mk-live-container {
	  padding: 0.25rem;
	}
	
	.stream-overlay {
	  top: 0.5rem !important;
	  right: 0.5rem !important;
	  gap: 0.25rem !important;
	  
	  .stream-info, .live-indicator {
		padding: 0.375rem 0.5rem !important;
		font-size: 0.8rem !important;
	  }
	}
	
	.fullscreen-overlay {
	  bottom: 1rem !important;
	  left: 1rem !important;
	  right: 1rem !important;
	  padding: 1rem !important;
	  
	  .fullscreen-info {
		flex-direction: column;
		gap: 1rem;
		align-items: flex-start;
		
		.stream-title {
		  font-size: 1.2rem !important;
		}
		
		.stream-stats {
		  align-self: stretch;
		  justify-content: space-between;
		}
	  }
	}
	
	.stream-details {
	  .streamer-info {
		.avatar {
		  width: 48px !important;
		  height: 48px !important;
		  border-width: 2px !important;
		}
		
		.text-content {
		  .name {
			font-size: 1.1rem !important;
		  }
		}
	  }
	}
  }
  </style>