/**
 * @fileoverview Orchestrator module exports.
 * Central coordination for Chati.dev agent pipeline.
 */

export {
  INTENT_TYPES,
  classifyIntent,
  getIntentPhase,
  checkModeAlignment,
} from './intent-classifier.js';

export {
  AGENT_PIPELINE,
  selectAgent,
  getNextAgent,
  isAgentAllowedInMode,
  getParallelGroups,
  getAgentDefinition,
  getPhaseAgents,
} from './agent-selector.js';

export {
  PIPELINE_PHASES,
  AGENT_STATUS,
  initPipeline,
  advancePipeline,
  checkPhaseTransition,
  getPipelineProgress,
  resetPipelineTo,
  isPipelineComplete,
  markAgentInProgress,
} from './pipeline-manager.js';

export {
  loadPipelineState,
  savePipelineState,
  updatePipelineState,
  sessionExists,
  deleteSession,
} from './pipeline-state.js';

export {
  executeHandoff,
  validateHandoffPreconditions,
  loadHandoffContext,
  getHandoffHistory,
  checkRollbackFeasibility,
} from './handoff-engine.js';

export {
  DEVIATION_TYPES,
  detectDeviation,
  analyzeDeviationImpact,
  applyDeviation,
  getDeviationHistory,
} from './deviation-handler.js';

export {
  initSession,
  loadSession,
  updateSession,
  recordModeTransition,
  recordAgentCompletion,
  getSessionSummary,
  validateSession,
} from './session-manager.js';
