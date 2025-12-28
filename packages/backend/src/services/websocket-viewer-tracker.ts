import { EventEmitter } from 'events';
import { Users, Streams } from '@/models/index.js';
import { getStreamServer } from '@/server/api/streaming.js';
import { publishStreamViewersStream } from '@/services/stream.js';

/**
 * Tracks viewer counts using WebSocket connections instead of Mux API
 */
class WebSocketViewerTracker extends EventEmitter {
	private viewerCounts: Map<string, Set<string>> = new Map(); // streamId -> Set of userIds
	private userToStreamMap: Map<string, string> = new Map(); // userId -> streamId being watched
	private updateInterval: NodeJS.Timeout | null = null;
	private readonly intervalMs = 5000; // Update every 5 seconds

	constructor() {
		super();
	}

	/**
	 * Start the viewer tracking service
	 */
	public start() {
		if (this.updateInterval) {
			return; // Already running
		}

		console.log('Starting WebSocket viewer tracker service...');
		this.updateInterval = setInterval(() => {
			this.updateViewerCountsFromConnections();
		}, this.intervalMs);

		// Run immediately on start
		this.updateViewerCountsFromConnections();
	}

	/**
	 * Stop the viewer tracking service
	 */
	public stop() {
		if (this.updateInterval) {
			clearInterval(this.updateInterval);
			this.updateInterval = null;
			console.log('Stopped WebSocket viewer tracker service');
		}
	}

	/**
	 * Track a user viewing a specific stream
	 */
	public addViewer(streamId: string, userId: string): void {
		try {
			// Remove user from any previous stream they were watching
			const previousStreamId = this.userToStreamMap.get(userId);
			if (previousStreamId && previousStreamId !== streamId) {
				this.removeViewer(previousStreamId, userId);
			}

			// Add user to current stream
			if (!this.viewerCounts.has(streamId)) {
				this.viewerCounts.set(streamId, new Set());
			}
			
			const viewers = this.viewerCounts.get(streamId)!;
			const wasNewViewer = !viewers.has(userId);
			viewers.add(userId);
			this.userToStreamMap.set(userId, streamId);

			if (wasNewViewer) {
				console.log(`User ${userId} started viewing stream ${streamId}. Total viewers: ${viewers.size}`);
				this.publishStreamViewerCount(streamId, viewers.size);
			}
		} catch (error) {
			console.error(`Error adding viewer ${userId} to stream ${streamId}:`, error);
		}
	}

	/**
	 * Remove a viewer from a stream
	 */
	public removeViewer(streamId: string, userId: string): void {
		try {
			const viewers = this.viewerCounts.get(streamId);
			if (viewers && viewers.has(userId)) {
				viewers.delete(userId);
				this.userToStreamMap.delete(userId);
				
				console.log(`User ${userId} stopped viewing stream ${streamId}. Total viewers: ${viewers.size}`);
				this.publishStreamViewerCount(streamId, viewers.size);

				// Clean up empty stream viewer sets
				if (viewers.size === 0) {
					this.viewerCounts.delete(streamId);
				}
			}
		} catch (error) {
			console.error(`Error removing viewer ${userId} from stream ${streamId}:`, error);
		}
	}

	/**
	 * Remove a user from all streams (when they disconnect)
	 */
	public removeUserFromAllStreams(userId: string): void {
		try {
			const streamId = this.userToStreamMap.get(userId);
			if (streamId) {
				console.log(`Removing user ${userId} from all streams (was viewing ${streamId})`);
				this.removeViewer(streamId, userId);
			}
		} catch (error) {
			console.error(`Error removing user ${userId} from all streams:`, error);
		}
	}

	/**
	 * Get current viewer count for a stream
	 */
	public getViewerCount(streamId: string): number {
		const viewers = this.viewerCounts.get(streamId);
		return viewers ? viewers.size : 0;
	}

	/**
	 * Get all current viewer counts
	 */
	public getAllViewerCounts(): Map<string, number> {
		const counts = new Map<string, number>();
		for (const [streamId, viewers] of this.viewerCounts.entries()) {
			counts.set(streamId, viewers.size);
		}
		return counts;
	}

	/**
	 * Check if a user is viewing a specific stream
	 */
	public isUserViewingStream(streamId: string, userId: string): boolean {
		const viewers = this.viewerCounts.get(streamId);
		return viewers ? viewers.has(userId) : false;
	}

	/**
	 * Publish viewer count update for a specific stream
	 */
	private publishStreamViewerCount(streamId: string, viewerCount: number): void {
		try {
			const updateData = {
				viewers: viewerCount,
				views: viewerCount, // For compatibility, use same value
				updated_at: new Date().toISOString(),
			};
			console.log(`Publishing viewer count update for stream ${streamId}: ${viewerCount} viewers`, updateData);
			publishStreamViewersStream(streamId, 'viewerUpdate', updateData);
		} catch (error) {
			console.error(`Failed to publish viewer count for stream ${streamId}:`, error);
		}
	}

	/**
	 * Publish viewer updates for all active streams
	 */
	private publishViewerUpdates(): void {
		for (const [streamId, viewers] of this.viewerCounts.entries()) {
			this.publishStreamViewerCount(streamId, viewers.size);
		}
	}

	/**
	 * Cleanup inactive viewers by checking if they still have active WebSocket connections
	 */
	public async cleanupInactiveViewers(): Promise<void> {
		const streamServer = getStreamServer();
		if (!streamServer) return;

		if (typeof streamServer.getConnections !== 'function') {
			console.warn('Stream server does not support getConnections(). Skipping cleanupInactiveViewers.');
			return;
		}

		const activeConnections = streamServer.getConnections();
		const activeUserIds = new Set(
			Array.from(activeConnections.values())
				.map(conn => conn.user?.id)
				.filter(Boolean)
		);

		// Remove viewers who no longer have active connections
		for (const [streamId, viewers] of this.viewerCounts.entries()) {
			const viewersToRemove: string[] = [];
			
			for (const userId of viewers) {
				if (!activeUserIds.has(userId)) {
					viewersToRemove.push(userId);
				}
			}

			for (const userId of viewersToRemove) {
				this.removeViewer(streamId, userId);
			}
		}
	}

	/**
	 * Get viewer counts for all live streams using WebSocket connections
	 */
	public async updateViewerCountsFromConnections(): Promise<void> {
		const streamServer = getStreamServer();
		if (!streamServer) return;

		// Get all live streams  
		const streams = await Streams.find({
			where: { isLive: true },
			select: ['id', 'userId'],
		});

		if (streams.length === 0) {
			// Clear all viewer counts if no streams are live
			this.viewerCounts.clear();
			this.userToStreamMap.clear();
			return;
		}

		console.log(`Updating viewer counts for ${streams.length} live streams`);

		// Clean up inactive viewers first
		await this.cleanupInactiveViewers();

		// Publish current viewer counts for all active streams
		for (const [streamId, viewers] of this.viewerCounts.entries()) {
			this.publishStreamViewerCount(streamId, viewers.size);
		}
	}

	/**
	 * Handle user starting to view a stream (called from WebSocket message)
	 */
	public handleStartViewing(userId: string, streamId: string): void {
		this.addViewer(streamId, userId);
	}

	/**
	 * Handle user stopping viewing a stream (called from WebSocket message)
	 */
	public handleStopViewing(userId: string, streamId: string): void {
		this.removeViewer(streamId, userId);
	}
}

// Export singleton instance
export const webSocketViewerTracker = new WebSocketViewerTracker();
