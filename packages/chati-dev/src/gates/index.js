/**
 * @fileoverview Quality Gates barrel exports and registry.
 *
 * Provides all gate classes and a registry function to look up
 * the appropriate gate for a given pipeline point.
 */

export { GateBase } from './gate-base.js';
export { CircuitBreaker, CIRCUIT_STATES } from './circuit-breaker.js';
export { PlanningCompleteGate } from './g1-planning-complete.js';
export { QAPlanningGate } from './g2-qa-planning.js';
export { ImplementationGate } from './g3-implementation.js';
export { QAImplementationGate, QA_IMPL_VERDICTS } from './g4-qa-implementation.js';
export { DeployReadyGate } from './g5-deploy-ready.js';

import { PlanningCompleteGate as _G1 } from './g1-planning-complete.js';
import { QAPlanningGate as _G2 } from './g2-qa-planning.js';
import { ImplementationGate as _G3 } from './g3-implementation.js';
import { QAImplementationGate as _G4 } from './g4-qa-implementation.js';
import { DeployReadyGate as _G5 } from './g5-deploy-ready.js';

/**
 * Pipeline point to gate class mapping.
 */
const PIPELINE_POINT_MAP = {
  'pre-build': _G1,
  'post-qa-planning': _G2,
  'post-dev': _G3,
  'post-qa-impl': _G4,
  'pre-deploy': _G5,
};

/**
 * Get the gate instance for a specific pipeline point.
 *
 * @param {string} point - Pipeline point identifier
 * @returns {import('./gate-base.js').GateBase} Gate instance
 * @throws {Error} If no gate is registered for the given point
 */
export function getGateForPipelinePoint(point) {
  const GateClass = PIPELINE_POINT_MAP[point];
  if (!GateClass) {
    throw new Error(`No gate registered for pipeline point: ${point}`);
  }
  return new GateClass();
}
