import Mux from '@mux/mux-node';
import { Streams, Users } from '@/models/index.js';
import { fetchMeta } from '@/misc/fetch-meta.js';
import { ApiError } from '../../error.js';
import define from '../../define.js';
import create from '@/services/note/create.js';

export const meta = {
  tags: ['stream'],
  requireCredential: true,
  requireCredentialPrivateMode: true,
  res: {
    type: 'object',
    optional: false,
    nullable: false,
    properties: {
      id: { type: 'string' },
      title: { type: 'string' },
      key: { type: 'string' },
      //url: { type: 'string' },
      streamKey: { type: 'string' },
      streamUrl: { type: 'string' }
    }
  },
  errors: {
    noMuxCredentials: {
      message: 'Mux credentials are not set.',
      code: 'NO_MUX_CREDENTIALS',
      id: '15b75394-3a3d-4dd8-a5c0-62f134cb2f73',
    },
    notPlusUser: {
      message: 'Only Plus and Mini Plus users can create streams.',
      code: 'NOT_PLUS_USER',
      id: '1d7c06cd-b9aa-4863-9534-fd8695099b8f',
    },
    streamDeletionError: {
      message: 'Failed to delete existing stream.',
      code: 'STREAM_DELETION_ERROR',
      id: 'f8d2a8e1-c9b4-4f5d-9e5a-3b7c8e4d2f1c',
    }
  },
} as const;

export const paramDef = {
  type: 'object',
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 128 },
    autoPost: { type: 'boolean', default: false },
    streamingMode: { type: 'string', enum: ['rtmp', 'browser'], default: 'rtmp' }
  },
  required: ['title'],
} as const;

async function deleteExistingStream(muxClient, existingStream) {
  try {
    // Delete from Mux first
    if (existingStream.id) {
      try {
        await muxClient.video.liveStreams.delete(existingStream.id);
        console.log(`Successfully deleted Mux stream: ${existingStream.id}`);
      } catch (muxErr) {
        console.error(`Failed to delete Mux stream ${existingStream.id}:`, muxErr);
        // Continue with database cleanup even if Mux deletion fails
      }
    }
    
    // Delete from database
    await Streams.delete({ id: existingStream.id });
    console.log(`Successfully deleted stream from database: ${existingStream.id}`);
    
    return true;
  } catch (err) {
    console.error('Error deleting stream:', err);
    throw new ApiError(meta.errors.streamDeletionError);
  }
}

export default define(meta, paramDef, async (ps, user) => {
  // Check if user has Plus or Mini Plus
  const u = await Users.findOneBy({ id: user.id });
  const isPlus = u?.isPlus || false;
  const isMPlus = u?.isMPlus || false;
  
  /*if (!isPlus && !isMPlus) {
    throw new ApiError(meta.errors.notPlusUser);
  }*/

  const instance = await fetchMeta();
  if (!instance.mux_access || !instance.mux_secret_key) {
    throw new ApiError(meta.errors.noMuxCredentials);
  }

  // Initialize Mux client
  const muxClient = new Mux({
    tokenId: instance.mux_access,
    tokenSecret: instance.mux_secret_key
  });

  // Check for and delete existing stream
  const existingStream = await Streams.findOneBy({ userId: user.id });
  if (existingStream) {
    await deleteExistingStream(muxClient, existingStream);
  }

  // Create new stream on Mux with low latency mode, public playback policy and master access
  const stream = await muxClient.video.liveStreams.create({
    latency_mode: 'low',
    reconnect_window: 60,
    playback_policy: ['public'],
    new_asset_settings: { 
      playback_policy: ['public'],
      master_access: 'temporary'
    }
  });

  // Get the playback ID and construct stream URL
  const playbackId = stream.playback_ids?.[0]?.id;
  if (!playbackId) {
    throw new ApiError({
      message: 'Failed to get playback ID from Mux stream',
      code: 'NO_PLAYBACK_ID',
      id: 'e1f2a3b4-c5d6-7e8f-9g0h-1i2j3k4l5m6n',
      httpStatusCode: 500,
    });
  }
  const streamUrl = `https://stream.mux.com/${playbackId}`;
  const rtmpUrl = 'rtmps://global-live.mux.com:443/app';

  // Create new stream record in database
  const insertResult = await Streams.insert({
    id: stream.id,
    userId: user.id,
    title: ps.title,
    key: stream.stream_key,
    url: streamUrl,
    playbackId: playbackId,
    updatedAt: new Date()
  });

  const newStream = {
    id: stream.id,
    title: ps.title,
    key: stream.stream_key,
    url: streamUrl,
    playbackId: playbackId
  };

  // Note: isLive status will be set by webhook when user actually starts streaming
  // Do not set isLive=true here as that should only happen when streaming begins
  await Users.update({ id: user.id }, { 
    liveUrl: stream.id
  });

  // Return different response based on streaming mode
  if (ps.streamingMode === 'browser') {
    return {
      id: stream.id,
      title: ps.title,
      key: stream.stream_key,
      streamKey: stream.stream_key,
      streamUrl: `/api/live/browser-stream`, // Will provide WebSocket URL
      streamingMode: 'browser'
    };
  } else {
    // Traditional RTMP streaming
    return {
      id: stream.id,
      title: ps.title,
      key: stream.stream_key,
      streamKey: stream.stream_key,
      streamUrl: rtmpUrl,
      streamingMode: 'rtmp'
    };
  }
});