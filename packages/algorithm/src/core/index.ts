/**
 * Core Algorithm Service
 * Main integration point for all algorithm components
 */

export {
  AlgorithmService,
  initializeAlgorithmService,
  getAlgorithmService,
  destroyAlgorithmService,
  type AlgorithmServiceConfig,
  type ServiceHealth
} from './algorithm-service.js';