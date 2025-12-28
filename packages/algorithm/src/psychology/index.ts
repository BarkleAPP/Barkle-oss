/**
 * Psychology Package Index
 * Exports all psychology-based engagement optimization modules
 */

export {
  BehavioralAddictionEngine,
  createBehavioralAddictionEngine,
  type PsychologyConfig,
  type ContentItem,
  type PsychologyEnhancedContent,
  type UserEngagementState
} from './behavioral-addiction-engine.js';

export {
  PsychologyTimelineService,
  getPsychologyTimelineService,
  CONTROL_CONFIG,
  LIGHT_PSYCHOLOGY_CONFIG,
  AGGRESSIVE_PSYCHOLOGY_CONFIG
} from './psychology-timeline-service.js';
