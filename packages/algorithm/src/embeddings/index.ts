/**
 * Collision-Free Embedding Tables
 * ByteDance Monolith-inspired Cuckoo hashing implementation
 */

export { 
  CuckooEmbeddingTable,
  createEmbeddingTable,
  type EmbeddingEntry,
  type HashFunction,
  type EmbeddingTableStats,
  type CuckooTableConfig
} from './cuckoo-embedding-table.js';

export {
  EmbeddingTableManager,
  getEmbeddingManager,
  initializeEmbeddingManager,
  destroyEmbeddingManager,
  type EmbeddingType,
  type EmbeddingRequest,
  type SystemEmbeddingStats,
  type EmbeddingManagerConfig
} from './embedding-table-manager.js';