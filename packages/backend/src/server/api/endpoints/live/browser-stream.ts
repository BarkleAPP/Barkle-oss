import { Streams, Users } from '@/models/index.js';
import { ApiError } from '../../error.js';
import define from '../../define.js';

export const meta = {
  tags: ['stream'],
  requireCredential: true,
  requireCredentialPrivateMode: true,
  res: {
    type: 'object',
    optional: false,
    nullable: false,
    properties: {
      websocketUrl: { type: 'string' },
      streamId: { type: 'string' },
      token: { type: 'string' }
    }
  },
  errors: {
    noExistingStream: {
      message: 'No existing stream found. Create a stream first.',
      code: 'NO_EXISTING_STREAM',
      id: 'a1b2c3d4-e5f6-7g8h-9i0j-1k2l3m4n5o6p',
    }
  },
} as const;

export const paramDef = {
  type: 'object',
  properties: {},
  required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
  // Check if user has an existing stream
  const existingStream = await Streams.findOneBy({ userId: user.id });
  if (!existingStream) {
    throw new ApiError(meta.errors.noExistingStream);
  }

  // Generate a temporary streaming token
  const streamingToken = generateStreamingToken(user.id, existingStream.id);
  
  // Return WebSocket URL for browser streaming
  return {
    websocketUrl: `/streaming/live/${existingStream.id}`,
    streamId: existingStream.id,
    token: streamingToken
  };
});

function generateStreamingToken(userId: string, streamId: string): string {
  // Simple token generation - in production, use proper JWT or similar
  const timestamp = Date.now();
  const payload = `${userId}:${streamId}:${timestamp}`;
  return Buffer.from(payload).toString('base64');
}
