/**
 * @fileoverview Autonomy module barrel exports
 * Execution modes, quality gates, progress reporting, and safety nets
 */

export {
  EXECUTION_MODES,
  getCurrentMode,
  setExecutionMode,
  canActAutonomously,
  getAlwaysHumanAgents,
  getModeHistory,
  clearExecutionMode,
  getModeStatistics,
} from './mode-manager.js';

export {
  suggestMode,
  calculateRiskScore,
  getHighRiskDomains,
} from './mode-suggester.js';

export {
  GATE_RESULTS,
  evaluateGate,
  getGateThreshold,
  resolveGateAction,
  getGateHistory,
  recordGateEvaluation,
  getGateStatistics,
  getAgentGateStatistics,
  clearGateHistory,
} from './autonomous-gate.js';

export {
  buildProgressReport,
  formatProgressLine,
  formatDetailedReport,
  calculateCompletion,
  getStageProgress,
} from './progress-reporter.js';

export {
  SAFETY_TRIGGERS,
  checkSafety,
  evaluateTrigger,
  getRecommendedAction,
  getCriticalRiskKeywords,
  isCriticalRisk,
  buildSafetyReport,
} from './safety-net.js';
