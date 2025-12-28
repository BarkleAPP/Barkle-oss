import Mux from '@mux/mux-node';
import { fetchMeta } from '@/misc/fetch-meta.js';
import config from '@/config/index.js';
import { Users, Streams, Notes } from '@/models/index.js';
import { uploadFromUrl } from '@/services/drive/upload-from-url.js';
import Logger from '@/services/logger.js';
import define from '../../define.js';
import { ApiError } from '@/server/api/error.js';
import create from '@/services/note/create.js';

const logger = new Logger('mux-webhook');

export const meta = {
    tags: ['webhook'],
    requireCredential: false,
    secure: false,
} as const;

export const paramDef = {
    type: 'object',
    properties: {
        type: { type: 'string' },
        object: {
            type: 'object',
            properties: {
                type: { type: 'string' },
                id: { type: 'string' }
            }
        },
        id: { type: 'string' },
        data: { 
            type: 'object',
            properties: {
                id: { type: 'string' },
                status: { type: 'string' },
                live_stream_id: { type: 'string' },
                is_live: { type: 'boolean' },
                playback_ids: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            policy: { type: 'string' }
                        }
                    }
                },
                tracks: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            type: { type: 'string' },
                            id: { type: 'string' },
                            max_height: { type: 'number' },
                            max_width: { type: 'number' }
                        }
                    }
                }
            },
            required: ['id']
        }
    },
    required: ['type', 'data']
} as const;

export default define(meta, paramDef, async (ps) => {
    try {
        logger.info(`Processing Mux event: ${ps.type}`);

        const instance = await fetchMeta();
        if (!instance.mux_token_id || !instance.mux_secret_key) {
            logger.error('Mux configuration is missing');
            throw new ApiError({
                message: 'Mux is not configured properly',
                code: 'MUX_MISCONFIGURED',
                id: 'c02b9a7d-2a8b-4c24-b99c-f4e33ccb1293',
                httpStatusCode: 500,
            });
        }

        // Initialize Mux client
        const muxClient = new Mux({
            tokenId: instance.mux_token_id,
            tokenSecret: instance.mux_secret_key
        });

        async function handleVodReady(data: any) {
            const assetId = data.id;
            logger.info(`VOD ready for asset ${assetId}, live_stream_id: ${data.live_stream_id}`);

            try {
                // Find the stream using live_stream_id
                const liveStreamId = data.live_stream_id;
                if (!liveStreamId) {
                    logger.warn(`No live stream ID found for asset ${assetId}`);
                    return;
                }

                const stream = await Streams.findOneBy({ id: liveStreamId });
                if (!stream) {
                    logger.warn(`No stream found for live stream ID ${liveStreamId}`);
                    return;
                }
                logger.info(`Found stream: ${stream.id} for user: ${stream.userId}`);

                const user = await Users.findOneBy({ id: stream.userId });
                if (!user) {
                    logger.warn(`No user found for stream ${stream.id}`);
                    return;
                }
                logger.info(`Found user: ${user.id} (${user.username})`);

                // Get the asset details to check master access
                const asset = await muxClient.video.assets.retrieve(assetId);
                logger.info(`Asset master_access: ${asset.master_access}`);

                if (asset.master && asset.master.status === 'ready' && asset.master.url) {
                    // Use the master URL for highest quality download
                    const masterUrl = asset.master.url;
                    logger.info(`Using master URL: ${masterUrl}`);
                    
                    const file = await uploadFromUrl({ 
                        url: masterUrl, 
                        user: user,
                        force: true,
                        bypassDriveCapacityCheck: true
                    });
                    
                    if (file) {
                        logger.info(`VOD uploaded successfully using master URL: ${file.id}`);
                        
                        // Delete from Mux to save storage
                        try {
                            await muxClient.video.assets.delete(assetId);
                            logger.info(`Deleted Mux asset ${assetId}`);
                        } catch (deleteError: any) {
                            logger.error(`Failed to delete Mux asset: ${deleteError.message}`);
                        }
                    } else {
                        logger.error('Failed to upload VOD file using master URL');
                    }
                } else {
                    logger.info(`Master not ready yet. Status: ${asset.master?.status || 'no master'}`);
                    
                    // If master access is 'none', enable it
                    if (asset.master_access === 'none') {
                        logger.info(`Enabling master access for asset ${assetId}`);
                        try {
                            await muxClient.video.assets.updateMasterAccess(assetId, { master_access: 'temporary' });
                            logger.info(`Master access enabled for asset ${assetId}. Will wait for master.ready event.`);
                        } catch (masterError: any) {
                            logger.error(`Failed to enable master access: ${masterError.message}`);
                        }
                    }
                    // The master will trigger a separate webhook when ready
                }

            } catch (error: any) {
                logger.error(`Error processing VOD: ${error.message}`);
                logger.error(`Error stack: ${error.stack}`);
            }
        }

        async function handleMasterReady(data: any) {
            const assetId = data.id;
            logger.info(`Master ready for asset ${assetId}, live_stream_id: ${data.live_stream_id}`);

            try {
                // Find the stream using live_stream_id
                const liveStreamId = data.live_stream_id;
                if (!liveStreamId) {
                    logger.warn(`No live stream ID found for asset ${assetId}`);
                    return;
                }

                const stream = await Streams.findOneBy({ id: liveStreamId });
                if (!stream) {
                    logger.warn(`No stream found for live stream ID ${liveStreamId}`);
                    return;
                }

                const user = await Users.findOneBy({ id: stream.userId });
                if (!user) {
                    logger.warn(`No user found for stream ${stream.id}`);
                    return;
                }
                logger.info(`Found user: ${user.id} (${user.username})`);

                // Get the master URL from the asset
                const asset = await muxClient.video.assets.retrieve(assetId);
                
                if (asset.master && asset.master.status === 'ready' && asset.master.url) {
                    const masterUrl = asset.master.url;
                    logger.info(`Downloading VOD from master URL: ${masterUrl}`);
                    
                    const file = await uploadFromUrl({ 
                        url: masterUrl, 
                        user: user,
                        force: true,
                        bypassDriveCapacityCheck: true
                    });
                    
                    if (file) {
                        logger.info(`VOD uploaded successfully from master: ${file.id}`);
                        
                        // Delete from Mux to save storage
                        try {
                            await muxClient.video.assets.delete(assetId);
                            logger.info(`Deleted Mux asset ${assetId}`);
                        } catch (deleteError: any) {
                            logger.error(`Failed to delete Mux asset: ${deleteError.message}`);
                        }
                    } else {
                        logger.error('Failed to upload VOD file from master URL');
                    }
                } else {
                    logger.error('Master URL not available');
                }

            } catch (error: any) {
                logger.error(`Error processing master ready: ${error.message}`);
                logger.error(`Error stack: ${error.stack}`);
            }
        }

        // Handle the event
        switch (ps.type) {
            case 'video.live_stream.connected':
                await handleStreamConnected(ps.data);
                break;
            case 'video.live_stream.active':
                await handleStreamActive(ps.data);
                break;
            case 'video.live_stream.idle':
            case 'video.live_stream.disconnected':
                await handleStreamDisconnected(ps.data);
                break;
            case 'video.asset.ready':
                await handleVodReady(ps.data);
                break;
            case 'video.asset.master.ready':
                await handleMasterReady(ps.data);
                break;
            case 'video.asset.live_stream_completed':
                logger.info(`Live stream completed for asset ${ps.data.id}`);
                // VOD processing will be handled by video.asset.ready or video.asset.master.ready events
                break;
            default:
                logger.info(`Unhandled event type: ${ps.type}`);
        }

        logger.info('Webhook processing completed successfully');
        return { received: true };
    } catch (error: any) {
        logger.error(`Error processing webhook: ${error.message}`);
        if (error instanceof ApiError) {
            throw error;
        } else {
            throw new ApiError({
                message: 'Internal server error',
                code: 'INTERNAL_SERVER_ERROR',
                id: '5d3f2d7a-8c8f-4b9c-9b6a-9b6a9b6a9b6b',
                httpStatusCode: 500,
            });
        }
    }
});

async function getStreamUrl(stream: any): Promise<string> {
    const user = await Users.findOneBy({ id: stream.userId });
    if (!user) {
        logger.warn(`No user found for stream ${stream.id}`);
        return '';
    }
    return `https://${config.host}/@${user.username}/live`;
}

async function createStreamNote(user: any, stream: any) {
    try {
        // Create announcement note for stream
        const note = await create(user, {
            createdAt: new Date(),
            text: `🎥 Live now: ${stream.title || 'Untitled Stream'}\n\n${stream.description || ''}\n\nWatch here: ${await getStreamUrl(stream)}`,
            visibility: 'public',
        });

        // Store the note ID in the streams table
        await Streams.update({ id: stream.id }, { 
            noteId: note.id,
        });

        logger.info(`Created announcement note ${note.id} for stream ${stream.id}`);
        return note;
    } catch (error: any) {
        logger.error(`Failed to create stream announcement note: ${error.message}`);
        throw error;
    }
}

async function handleStreamConnected(data: any) {
    const streamId = data.id;
    logger.info(`Handling stream connected for stream ${streamId}`);

    try {
        const stream = await Streams.findOneBy({ id: streamId });
        if (!stream) {
            logger.warn(`No stream found with ID ${streamId}`);
            return;
        }

        const user = await Users.findOneBy({ id: stream.userId });
        if (!user) {
            logger.warn(`No user found for stream ${stream.id}`);
            return;
        }

        logger.info(`User ${stream.userId} current isLive status: ${user.isLive}, liveUrl: ${user.liveUrl}`);

        // Set user as live when encoder connects (immediate feedback)
        await Users.update({ id: stream.userId }, { 
            isLive: true,
            liveUrl: stream.id
        });

        logger.info(`Encoder connected to stream ${streamId} for user ${stream.userId} - set user as live`);

        // Create stream announcement note if not already created
        if (!stream.noteId) {
            await createStreamNote(user, stream);
        }
    } catch (error: any) {
        logger.error(`Error handling stream connected event: ${error.message}`);
        throw new ApiError({
            message: 'Failed to process stream connected event',
            code: 'STREAM_CONNECTED_FAILED',
            id: '1a2b3c4d-5e6f-7g8h-9i0j-1k2l3m4n5o8p',
            httpStatusCode: 500,
        });
    }
}

async function handleStreamActive(data: any) {
    const streamId = data.id;
    logger.info(`Handling stream active for stream ${streamId}`);

    try {
        const stream = await Streams.findOneBy({ id: streamId });
        if (!stream) {
            logger.warn(`No stream found with ID ${streamId}`);
            return;
        }

        const user = await Users.findOneBy({ id: stream.userId });
        if (!user) {
            logger.warn(`No user found for stream ${stream.id}`);
            return;
        }

        // Set user as live when stream becomes active (actually streaming)
        await Users.update({ id: stream.userId }, { 
            isLive: true,
            liveUrl: stream.id
        });

        logger.info(`Stream ${streamId} is now active - set user ${stream.userId} as live`);

        // Create stream announcement note if not already created
        if (!stream.noteId) {
            await createStreamNote(user, stream);
        }
    } catch (error: any) {
        logger.error(`Error handling stream active event: ${error.message}`);
        throw new ApiError({
            message: 'Failed to process stream active event',
            code: 'STREAM_ACTIVE_FAILED',
            id: '2b3c4d5e-6f7g-8h9i-0j1k-2l3m4n5o6p9q',
            httpStatusCode: 500,
        });
    }
}

async function handleStreamDisconnected(data: any) {
    const streamId = data.id;
    logger.info(`Stream disconnected: ${streamId}, status: ${data.status}`);

    try {
        const stream = await Streams.findOneBy({ id: streamId });
        if (!stream) {
            logger.warn(`No stream found with ID ${streamId}`);
            return;
        }

        // Add a small delay to prevent race conditions with reconnections
        setTimeout(async () => {
            // Check if stream is still disconnected after delay
            try {
                const updatedUser = await Users.findOneBy({ id: stream.userId });
                if (updatedUser && updatedUser.liveUrl === stream.id) {
                    // Set user as not live on disconnect
                    await Users.update({ id: stream.userId }, { 
                        isLive: false,
                        liveUrl: null
                    });
                    logger.info(`Stream ${streamId} disconnected - user ${stream.userId} no longer live`);
                } else {
                    logger.info(`Stream ${streamId} disconnected but user ${stream.userId} is already not live or streaming different stream`);
                }
            } catch (delayedError: any) {
                logger.error(`Error in delayed disconnect handler: ${delayedError.message}`);
            }
        }, 2000); // 2 second delay to allow for quick reconnections
        
    } catch (error: any) {
        logger.error(`Error handling stream disconnected: ${error.message}`);
    }
}