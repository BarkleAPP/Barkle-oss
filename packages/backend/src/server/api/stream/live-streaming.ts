import * as websocket from 'websocket';
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { Streams, Users } from '@/models/index.js';
import { fetchMeta } from '@/misc/fetch-meta.js';
import { findFFmpeg } from '@/misc/ffmpeg-path.js';

interface LiveStreamConnection {
  connection: websocket.connection;
  streamId: string;
  userId: string;
  ffmpegProcess?: ChildProcess;
  isStreaming: boolean;
}

export class LiveStreamingHandler extends EventEmitter {
  private connections: Map<string, LiveStreamConnection> = new Map();

  constructor() {
    super();
  }

  async handleConnection(connection: websocket.connection, streamId: string, userId: string) {
    const connectionId = `${userId}_${streamId}`;
    
    // Verify stream exists and belongs to user
    const stream = await Streams.findOneBy({ id: streamId, userId });
    if (!stream) {
      connection.close(1008, 'Invalid stream or unauthorized');
      return;
    }

    const liveConnection: LiveStreamConnection = {
      connection,
      streamId,
      userId,
      isStreaming: false
    };

    this.connections.set(connectionId, liveConnection);

    connection.on('message', (message) => {
      this.handleMessage(connectionId, message);
    });

    connection.on('close', () => {
      this.handleDisconnection(connectionId);
    });

    // Send ready signal to client
    connection.send(JSON.stringify({
      type: 'ready',
      message: 'WebSocket connection established. Ready to receive video data.'
    }));
  }

  private async handleMessage(connectionId: string, message: websocket.IMessage) {
    const conn = this.connections.get(connectionId);
    if (!conn) return;

    if (message.type === 'utf8' && message.utf8Data) {
      try {
        const data = JSON.parse(message.utf8Data);
        
        if (data.type === 'start-stream') {
          await this.startFFmpegProcess(connectionId, data.config);
        } else if (data.type === 'stop-stream') {
          await this.stopFFmpegProcess(connectionId);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    } else if (message.type === 'binary' && message.binaryData) {
      // Handle video chunks
      await this.handleVideoChunk(connectionId, message.binaryData);
    }
  }

  private async startFFmpegProcess(connectionId: string, config: any) {
    const conn = this.connections.get(connectionId);
    if (!conn || conn.isStreaming) return;

    try {
      // Get stream details
      const stream = await Streams.findOneBy({ id: conn.streamId });
      if (!stream) return;

      // Get instance Mux credentials
      const instance = await fetchMeta();
      if (!instance.mux_access || !instance.mux_secret_key) {
        conn.connection.send(JSON.stringify({
          type: 'error',
          message: 'Mux credentials not configured'
        }));
        return;
      }

      // Start FFmpeg process
      const rtmpUrl = `rtmps://global-live.mux.com:443/app/${stream.key}`;
      
      const ffmpegArgs = [
        '-f', 'webm',
        '-i', 'pipe:0',
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-tune', 'zerolatency',
        '-c:a', 'aac',
        '-ar', '44100',
        '-b:a', '128k',
        '-b:v', '2500k',
        '-f', 'flv',
        rtmpUrl
      ];

      const ffmpeg = spawn(findFFmpeg(), ffmpegArgs);
      
      ffmpeg.stderr.on('data', (data) => {
        console.log(`FFmpeg stderr: ${data}`);
      });

      ffmpeg.on('close', (code) => {
        console.log(`FFmpeg process closed with code ${code}`);
        conn.isStreaming = false;
        conn.connection.send(JSON.stringify({
          type: 'stream-ended',
          message: 'Stream ended'
        }));
      });

      ffmpeg.on('error', (error) => {
        console.error('FFmpeg error:', error);
        conn.connection.send(JSON.stringify({
          type: 'error',
          message: 'Streaming error occurred'
        }));
      });

      conn.ffmpegProcess = ffmpeg;
      conn.isStreaming = true;

      // Update stream status in database
      await this.updateStreamStatus(conn.streamId, true);

      conn.connection.send(JSON.stringify({
        type: 'stream-started',
        message: 'Stream started successfully'
      }));

    } catch (error) {
      console.error('Error starting FFmpeg process:', error);
      conn.connection.send(JSON.stringify({
        type: 'error',
        message: 'Failed to start stream'
      }));
    }
  }

  private async handleVideoChunk(connectionId: string, chunk: Buffer) {
    const conn = this.connections.get(connectionId);
    if (!conn || !conn.ffmpegProcess || !conn.isStreaming) return;

    try {
      conn.ffmpegProcess.stdin.write(chunk);
    } catch (error) {
      console.error('Error writing to FFmpeg:', error);
    }
  }

  private async stopFFmpegProcess(connectionId: string) {
    const conn = this.connections.get(connectionId);
    if (!conn || !conn.ffmpegProcess) return;

    try {
      conn.ffmpegProcess.kill('SIGINT');
      conn.isStreaming = false;
      
      // Update stream status in database
      await this.updateStreamStatus(conn.streamId, false);
      
      conn.connection.send(JSON.stringify({
        type: 'stream-stopped',
        message: 'Stream stopped'
      }));
    } catch (error) {
      console.error('Error stopping FFmpeg process:', error);
    }
  }

  private async handleDisconnection(connectionId: string) {
    const conn = this.connections.get(connectionId);
    if (!conn) return;

    // Clean up FFmpeg process
    if (conn.ffmpegProcess) {
      await this.stopFFmpegProcess(connectionId);
    }

    this.connections.delete(connectionId);
  }

  private async updateStreamStatus(streamId: string, isLive: boolean) {
    try {
      const stream = await Streams.findOneBy({ id: streamId });
      if (stream) {
        // Update user's live status
        await Users.update({ id: stream.userId }, { 
          isLive: isLive,
          liveUrl: isLive ? streamId : null
        });
      }
    } catch (error) {
      console.error('Error updating stream status:', error);
    }
  }
}

export const liveStreamingHandler = new LiveStreamingHandler();
