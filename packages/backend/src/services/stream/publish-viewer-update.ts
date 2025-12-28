import { publishStreamViewersStream } from '../stream.js';

export async function publishStreamViewerUpdate(streamId: string, viewerData: { views: number; viewers: number; updated_at: string }) {
	try {
		publishStreamViewersStream(streamId, 'viewerUpdate', viewerData);
	} catch (error) {
		console.error('Failed to publish stream viewer update:', error);
	}
}
