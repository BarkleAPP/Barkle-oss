import { fetchMeta } from '@/misc/fetch-meta.js';
import { Users, Streams } from '@/models/index.js';
import { publishStreamViewersStream } from '@/services/stream.js';
import * as jsrsasign from 'jsrsasign';

/**
 * Background service to periodically fetch and publish live stream viewer counts
 * NOTE: This service is now deprecated in favor of WebSocket-based viewer tracking.
 * It's kept for backwards compatibility but should not be started.
 */
class StreamViewerUpdater {
	private updateInterval: NodeJS.Timer | null = null;
	private readonly intervalMs = 30000; // Update every 30 seconds

	public start() {
		console.warn('StreamViewerUpdater is deprecated - using WebSocket-based viewer tracking instead');
		// Do not start the Mux-based updater
		return;
	}

	public stop() {
		if (this.updateInterval) {
			clearInterval(this.updateInterval);
			this.updateInterval = null;
			console.log('Stopped stream viewer updater service');
		}
	}

	private async updateAllStreamViewers() {
		// This method is now deprecated - WebSocket tracking handles this
		console.warn('updateAllStreamViewers called on deprecated service');
	}

	private async updateUserStreamViewers(userId: string) {
		// This method is now deprecated - WebSocket tracking handles this
		console.warn('updateUserStreamViewers called on deprecated service');
	}

	private async fetchMuxViewerData(playbackId: string): Promise<{ views: number; viewers: number; updated_at: string }> {
		// This method is now deprecated - WebSocket tracking handles this
		console.warn('fetchMuxViewerData called on deprecated service');
		return {
			views: 0,
			viewers: 0,
			updated_at: new Date().toISOString(),
		};
	}
}

// Export singleton instance
export const streamViewerUpdater = new StreamViewerUpdater();
