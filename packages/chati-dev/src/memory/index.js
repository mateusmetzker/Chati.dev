// Barrel exports for memory system

export {
  recordError,
  getGotchas,
  getRelevantGotchas,
  getGotchaStats,
  clearExpiredErrors,
  updateGotchaResolution,
} from './gotchas.js';

export {
  buildGotchasContext,
  buildCompactGotchasSummary,
} from './gotchas-injector.js';

export {
  readAgentMemory,
  writeAgentMemory,
  searchAgentMemories,
  getAgentMemoryStats,
} from './agent-memory.js';

export {
  buildSessionDigest,
  saveSessionDigest,
  loadLatestDigest,
  listDigests,
  pruneDigests,
} from './session-digest.js';

export {
  searchAllMemories,
  getUnifiedMemoryStats,
} from './search.js';
