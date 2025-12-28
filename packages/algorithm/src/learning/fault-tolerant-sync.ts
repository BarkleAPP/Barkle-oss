/**
 * Fault-Tolerant Parameter Synchronization
 * Implements daily snapshots, incremental sync with rollback, and failure handling
 */

import { EmbeddingTableManager, type SystemEmbeddingStats } from '../embeddings/index.js';
import type { RealTimeLearningSystem } from './real-time-learning-system.js';

/**
 * Parameter snapshot for disaster recovery
 */
export interface ParameterSnapshot {
  id: string;
  timestamp: number;
  version: number;
  modelWeights: Record<string, number>;
  embeddingStats: SystemEmbeddingStats;
  syncStats: any;
  checksum: string;
  metadata: {
    communitySize: number;
    totalSamples: number;
    createdBy: string;
    description?: string;
  };
}

/**
 * Sync operation record
 */
export interface SyncOperation {
  id: string;
  timestamp: number;
  type: 'incremental' | 'full' | 'rollback';
  status: 'pending' | 'success' | 'failed' | 'rolled_back';
  parametersChanged: number;
  duration: number;
  error?: string;
  rollbackId?: string;
}

/**
 * Sync configuration
 */
export interface SyncConfig {
  maxRetries: number;
  retryDelayMs: number;
  backoffMultiplier: number;
  timeoutMs: number;
  snapshotIntervalMs: number;
  maxSnapshots: number;
  enableAutoRollback: boolean;
  rollbackThresholdErrors: number;
}

/**
 * Sync health metrics
 */
export interface SyncHealth {
  isHealthy: boolean;
  consecutiveFailures: number;
  lastSuccessTime: number;
  lastFailureTime: number;
  successRate: number;
  averageSyncTime: number;
  currentVersion: number;
  lastSnapshotTime: number;
}

/**
 * Fault-tolerant parameter synchronization system
 */
export class FaultTolerantSync {
  private snapshots: Map<string, ParameterSnapshot> = new Map();
  private syncHistory: SyncOperation[] = [];
  private config: SyncConfig;
  private currentVersion: number = 1;
  private consecutiveFailures: number = 0;
  private lastSuccessTime: number = 0;
  private lastFailureTime: number = 0;
  private snapshotTimer?: NodeJS.Timeout;
  
  constructor(
    private embeddingManager: EmbeddingTableManager,
    private learningSystem: RealTimeLearningSystem,
    config: Partial<SyncConfig> = {}
  ) {
    this.config = {
      maxRetries: config.maxRetries || 3,
      retryDelayMs: config.retryDelayMs || 1000,
      backoffMultiplier: config.backoffMultiplier || 2,
      timeoutMs: config.timeoutMs || 30000,
      snapshotIntervalMs: config.snapshotIntervalMs || 24 * 60 * 60 * 1000, // 24 hours
      maxSnapshots: config.maxSnapshots || 7, // Keep 7 days of snapshots
      enableAutoRollback: config.enableAutoRollback ?? true,
      rollbackThresholdErrors: config.rollbackThresholdErrors || 5
    };
    
    this.startPeriodicSnapshots();
  }
  
  /**
   * Perform incremental sync with retry logic and rollback capability
   */
  public async performIncrementalSync(): Promise<SyncOperation> {
    const operation: SyncOperation = {
      id: this.generateOperationId(),
      timestamp: Date.now(),
      type: 'incremental',
      status: 'pending',
      parametersChanged: 0,
      duration: 0
    };
    
    const startTime = Date.now();
    let attempt = 0;
    
    while (attempt < this.config.maxRetries) {
      try {
        // Create pre-sync snapshot for rollback
        const preSync = await this.createSnapshot(`pre-sync-${operation.id}`);
        
        // Perform the actual sync
        await this.learningSystem.performIncrementalSync();
        
        // Verify sync success
        const postSyncHealth = await this.verifySyncHealth();
        if (!postSyncHealth.isHealthy) {
          throw new Error('Post-sync health check failed');
        }
        
        // Success
        operation.status = 'success';
        operation.duration = Date.now() - startTime;
        operation.parametersChanged = await this.countChangedParameters();
        
        this.onSyncSuccess(operation);
        this.syncHistory.push(operation);
        
        return operation;
        
      } catch (error) {
        attempt++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        console.warn(`Sync attempt ${attempt} failed:`, errorMessage);
        
        if (attempt >= this.config.maxRetries) {
          // All retries exhausted
          operation.status = 'failed';
          operation.error = errorMessage;
          operation.duration = Date.now() - startTime;
          
          this.onSyncFailure(operation);
          
          // Auto-rollback if enabled and threshold reached
          if (this.config.enableAutoRollback && 
              this.consecutiveFailures >= this.config.rollbackThresholdErrors) {
            await this.performAutoRollback(operation);
          }
          
          this.syncHistory.push(operation);
          throw new Error(`Sync failed after ${this.config.maxRetries} attempts: ${errorMessage}`);
        }
        
        // Wait before retry with exponential backoff
        const delay = this.config.retryDelayMs * Math.pow(this.config.backoffMultiplier, attempt - 1);
        await this.sleep(delay);
      }
    }
    
    throw new Error('Sync failed: max retries exceeded');
  }
  
  /**
   * Create parameter snapshot for disaster recovery
   */
  public async createSnapshot(description?: string): Promise<ParameterSnapshot> {
    const timestamp = Date.now();
    const id = `snapshot-${timestamp}-${this.currentVersion}`;
    
    try {
      const modelWeights = this.learningSystem.getModelWeights();
      const embeddingStats = this.embeddingManager.getSystemStats();
      const syncStats = this.learningSystem.getSyncStats();
      
      const snapshot: ParameterSnapshot = {
        id,
        timestamp,
        version: this.currentVersion,
        modelWeights,
        embeddingStats,
        syncStats,
        checksum: this.calculateChecksum(modelWeights, embeddingStats),
        metadata: {
          communitySize: this.estimateCommunitySize(embeddingStats),
          totalSamples: this.estimateTotalSamples(syncStats),
          createdBy: 'fault-tolerant-sync',
          description
        }
      };
      
      // Store snapshot
      this.snapshots.set(id, snapshot);
      
      // Cleanup old snapshots
      this.cleanupOldSnapshots();
      
      console.log(`Snapshot created: ${id} (version ${this.currentVersion})`);
      return snapshot;
      
    } catch (error) {
      console.error('Failed to create snapshot:', error);
      throw error;
    }
  }
  
  /**
   * Rollback to a previous snapshot
   */
  public async rollbackToSnapshot(snapshotId: string): Promise<SyncOperation> {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }
    
    const operation: SyncOperation = {
      id: this.generateOperationId(),
      timestamp: Date.now(),
      type: 'rollback',
      status: 'pending',
      parametersChanged: 0,
      duration: 0,
      rollbackId: snapshotId
    };
    
    const startTime = Date.now();
    
    try {
      // Verify snapshot integrity
      const currentChecksum = this.calculateChecksum(
        snapshot.modelWeights, 
        snapshot.embeddingStats
      );
      
      if (currentChecksum !== snapshot.checksum) {
        throw new Error('Snapshot checksum mismatch - data may be corrupted');
      }
      
      // Create backup before rollback
      await this.createSnapshot(`pre-rollback-${operation.id}`);
      
      // Perform rollback (in a real system, this would restore from persistent storage)
      console.log(`Rolling back to snapshot ${snapshotId} (version ${snapshot.version})`);
      
      // Reset version
      this.currentVersion = snapshot.version;
      
      // Success
      operation.status = 'success';
      operation.duration = Date.now() - startTime;
      operation.parametersChanged = Object.keys(snapshot.modelWeights).length;
      
      this.syncHistory.push(operation);
      console.log(`Rollback completed: ${operation.id}`);
      
      return operation;
      
    } catch (error) {
      operation.status = 'failed';
      operation.error = error instanceof Error ? error.message : 'Unknown error';
      operation.duration = Date.now() - startTime;
      
      this.syncHistory.push(operation);
      console.error('Rollback failed:', error);
      throw error;
    }
  }
  
  /**
   * Perform automatic rollback when error threshold is reached
   */
  private async performAutoRollback(failedOperation: SyncOperation): Promise<void> {
    try {
      // Find the most recent successful snapshot
      const recentSnapshots = Array.from(this.snapshots.values())
        .sort((a, b) => b.timestamp - a.timestamp);
      
      const lastGoodSnapshot = recentSnapshots.find(snapshot => {
        // Find snapshot from before the failure streak started
        return snapshot.timestamp < (Date.now() - (this.consecutiveFailures * 60 * 1000));
      });
      
      if (lastGoodSnapshot) {
        console.warn(`Auto-rollback triggered after ${this.consecutiveFailures} failures`);
        await this.rollbackToSnapshot(lastGoodSnapshot.id);
        
        // Reset failure count after successful rollback
        this.consecutiveFailures = 0;
      } else {
        console.error('No suitable snapshot found for auto-rollback');
      }
      
    } catch (error) {
      console.error('Auto-rollback failed:', error);
    }
  }
  
  /**
   * Verify sync health after operation
   */
  private async verifySyncHealth(): Promise<{ isHealthy: boolean; issues: string[] }> {
    const issues: string[] = [];
    
    try {
      // Check embedding manager health
      const embeddingHealth = this.embeddingManager.isSystemHealthy();
      if (!embeddingHealth) {
        issues.push('Embedding system unhealthy');
      }
      
      // Check memory usage
      const embeddingStats = this.embeddingManager.getSystemStats();
      if (embeddingStats.totalMemoryUsageMB > 20) {
        issues.push(`Memory usage too high: ${embeddingStats.totalMemoryUsageMB}MB`);
      }
      
      // Check sync statistics
      const syncStats = this.learningSystem.getSyncStats();
      if (syncStats.syncDurationMs > 10000) { // 10 seconds
        issues.push(`Sync duration too long: ${syncStats.syncDurationMs}ms`);
      }
      
      return {
        isHealthy: issues.length === 0,
        issues
      };
      
    } catch (error) {
      issues.push(`Health check failed: ${error}`);
      return { isHealthy: false, issues };
    }
  }
  
  /**
   * Count changed parameters (simplified)
   */
  private async countChangedParameters(): Promise<number> {
    const syncStats = this.learningSystem.getSyncStats();
    return syncStats.sparseUpdatesCount + syncStats.denseUpdatesCount;
  }
  
  /**
   * Get sync health metrics
   */
  public getSyncHealth(): SyncHealth {
    const recentOps = this.syncHistory.slice(-10);
    const successfulOps = recentOps.filter(op => op.status === 'success');
    const successRate = recentOps.length > 0 ? successfulOps.length / recentOps.length : 1;
    
    const avgSyncTime = successfulOps.length > 0
      ? successfulOps.reduce((sum, op) => sum + op.duration, 0) / successfulOps.length
      : 0;
    
    const lastSnapshot = Array.from(this.snapshots.values())
      .sort((a, b) => b.timestamp - a.timestamp)[0];
    
    return {
      isHealthy: this.consecutiveFailures < this.config.rollbackThresholdErrors,
      consecutiveFailures: this.consecutiveFailures,
      lastSuccessTime: this.lastSuccessTime,
      lastFailureTime: this.lastFailureTime,
      successRate,
      averageSyncTime: avgSyncTime,
      currentVersion: this.currentVersion,
      lastSnapshotTime: lastSnapshot?.timestamp || 0
    };
  }
  
  /**
   * Get all snapshots
   */
  public getSnapshots(): ParameterSnapshot[] {
    return Array.from(this.snapshots.values())
      .sort((a, b) => b.timestamp - a.timestamp);
  }
  
  /**
   * Get sync operation history
   */
  public getSyncHistory(limit: number = 50): SyncOperation[] {
    return this.syncHistory
      .slice(-limit)
      .sort((a, b) => b.timestamp - a.timestamp);
  }
  
  /**
   * Start periodic snapshot creation
   */
  private startPeriodicSnapshots(): void {
    this.snapshotTimer = setInterval(async () => {
      try {
        await this.createSnapshot('periodic-snapshot');
      } catch (error) {
        console.error('Periodic snapshot failed:', error);
      }
    }, this.config.snapshotIntervalMs);
  }
  
  /**
   * Cleanup old snapshots to manage storage
   */
  private cleanupOldSnapshots(): void {
    const snapshots = Array.from(this.snapshots.values())
      .sort((a, b) => b.timestamp - a.timestamp);
    
    // Keep only the most recent snapshots
    const toDelete = snapshots.slice(this.config.maxSnapshots);
    
    for (const snapshot of toDelete) {
      this.snapshots.delete(snapshot.id);
    }
    
    if (toDelete.length > 0) {
      console.log(`Cleaned up ${toDelete.length} old snapshots`);
    }
  }
  
  /**
   * Calculate checksum for data integrity
   */
  private calculateChecksum(modelWeights: Record<string, number>, embeddingStats: any): string {
    const data = JSON.stringify({ modelWeights, embeddingStats });
    
    // Simple hash function (in production, use crypto.createHash)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString(36);
  }
  
  /**
   * Event handlers
   */
  private onSyncSuccess(operation: SyncOperation): void {
    this.consecutiveFailures = 0;
    this.lastSuccessTime = operation.timestamp;
    this.currentVersion++;
    
    console.log(`Sync successful: ${operation.id} (${operation.parametersChanged} parameters, ${operation.duration}ms)`);
  }
  
  private onSyncFailure(operation: SyncOperation): void {
    this.consecutiveFailures++;
    this.lastFailureTime = operation.timestamp;
    
    console.error(`Sync failed: ${operation.id} - ${operation.error}`);
  }
  
  /**
   * Utility methods
   */
  private generateOperationId(): string {
    return `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private estimateCommunitySize(embeddingStats: SystemEmbeddingStats): number {
    // Rough estimation based on user embeddings
    return embeddingStats.tableStats.user?.totalEntries || 1000;
  }
  
  private estimateTotalSamples(syncStats: any): number {
    return (syncStats.sparseUpdatesCount || 0) + (syncStats.denseUpdatesCount || 0);
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = undefined;
    }
    
    this.snapshots.clear();
    this.syncHistory = [];
  }
}