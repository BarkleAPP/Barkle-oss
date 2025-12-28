import cluster from 'node:cluster';
import { initDb } from '../db/postgre.js';
import { initializeFirebase } from '../services/firebase-messaging.js';
import { AlgorithmSystemInitializer } from '../services/algorithm-system-initializer.js';

/**
 * Init worker process
 */
export async function workerMain() {
	await initDb();

	// Initialize Firebase Admin SDK
	await initializeFirebase();

	// Initialize algorithm system with persistence
	await AlgorithmSystemInitializer.initialize(1000); // Default community size

	// start server
	await import('../server/index.js').then(x => x.default());

	// start job queue
	import('../queue/index.js').then(x => x.default());

	// start subscription expiry daemon
	import('../daemons/subscription-expiry-daemon.js').then(x => {
		x.SubscriptionExpiryDaemon.start();
	});

	// Graceful shutdown handler
	process.on('SIGTERM', async () => {
		console.log('SIGTERM received, shutting down gracefully...');
		await AlgorithmSystemInitializer.shutdown();
		process.exit(0);
	});

	process.on('SIGINT', async () => {
		console.log('SIGINT received, shutting down gracefully...');
		await AlgorithmSystemInitializer.shutdown();
		process.exit(0);
	});

	if (cluster.isWorker) {
		// Send a 'ready' message to parent process
		process.send!('ready');
	}
}
