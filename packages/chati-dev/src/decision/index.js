/**
 * Decision Engine - COMPASS for chati.dev
 * Barrel exports for decision engine modules
 *
 * @module decision
 */

export {
  analyzeRequest,
  calculateSimilarity,
  getDecisionHistory,
  recordDecision,
  getEngineStats
} from './engine.js';

export {
  analyzeImpact,
  buildDependencyGraph,
  getTransitiveDependents
} from './analyzer.js';

export {
  updateRegistry,
  detectNewEntities,
  detectRemovedEntities,
  generateEntityMeta
} from './registry-updater.js';

export {
  healRegistry,
  detectMissingEntities,
  detectOrphanedEntries,
  detectStaleMetadata,
  detectDuplicates,
  detectInvalidPaths,
  detectCountMismatch,
  applyFixes
} from './registry-healer.js';
