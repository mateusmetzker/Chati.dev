/**
 * @fileoverview Autonomous quality gate evaluation
 * Evaluates quality gates without human input using score-based heuristics
 */

import { loadSession, updateSession } from '../orchestrator/session-manager.js';

/**
 * Gate result types.
 */
export const GATE_RESULTS = {
  PASS: 'pass',
  FAIL: 'fail',
  REVIEW: 'review', // Borderline — pause for human review even in autonomous mode
};

// Minimum passing scores per agent (conservative: 90 default)
const GATE_THRESHOLDS = {
  'qa-planning': 95,        // Highest — gates planning→build transition
  'qa-implementation': 95,  // Gates build→deploy transition
  'brief': 90,              // Requirements are critical
  'detail': 90,
  'architect': 90,
  'ux': 90,
  'phases': 90,
  'tasks': 90,
  'dev': 90,
  'devops': 90,
  'greenfield-wu': 90,
  'brownfield-wu': 90,
  // Default for any other agent
  '_default': 90,
};

// Review range: within 5 points of threshold triggers REVIEW
const REVIEW_RANGE = 5;

/**
 * Evaluate a quality gate autonomously.
 *
 * @param {object} gateInput
 * @param {string} gateInput.agent - Agent that produced the work
 * @param {number} gateInput.score - Self-reported quality score (0-100)
 * @param {string[]} gateInput.criteriaResults - Which criteria passed
 * @param {string[]} gateInput.allCriteria - All criteria for this gate
 * @param {number} [gateInput.confidence] - Agent's confidence (0-100)
 * @param {string[]} [gateInput.warnings] - Any warnings produced
 * @returns {{ result: string, score: number, reasoning: string, canProceed: boolean }}
 */
export function evaluateGate(gateInput) {
  const {
    agent,
    score,
    criteriaResults = [],
    allCriteria = [],
    confidence = 100,
    warnings = [],
  } = gateInput;

  // Validate inputs
  if (typeof score !== 'number' || score < 0 || score > 100) {
    throw new Error(`Invalid score: ${score}. Must be 0-100.`);
  }

  const threshold = getGateThreshold(agent);
  const criteriaScore = allCriteria.length > 0
    ? (criteriaResults.length / allCriteria.length) * 100
    : 100;

  // Combine self-reported score and criteria score
  const weightedScore = (score * 0.6) + (criteriaScore * 0.4);

  // Factor in confidence
  const confidencePenalty = confidence < 80 ? (80 - confidence) * 0.2 : 0;
  const finalScore = Math.max(0, weightedScore - confidencePenalty);

  // Factor in warnings
  const warningPenalty = warnings.length * 3;
  const adjustedScore = Math.max(0, finalScore - warningPenalty);

  // Determine result
  let result;
  const reasoning = [];

  if (adjustedScore >= threshold) {
    result = GATE_RESULTS.PASS;
    reasoning.push(`Score ${Math.round(adjustedScore)}% meets threshold ${threshold}%`);
  } else if (adjustedScore >= threshold - REVIEW_RANGE) {
    result = GATE_RESULTS.REVIEW;
    reasoning.push(`Score ${Math.round(adjustedScore)}% is borderline (threshold: ${threshold}%)`);
    reasoning.push('Manual review recommended');
  } else {
    result = GATE_RESULTS.FAIL;
    reasoning.push(`Score ${Math.round(adjustedScore)}% below threshold ${threshold}%`);
  }

  // Add details
  reasoning.push(`Criteria: ${criteriaResults.length}/${allCriteria.length} passed`);

  if (confidence < 80) {
    reasoning.push(`Low confidence (${confidence}%) reduced score by ${Math.round(confidencePenalty)}%`);
  }

  if (warnings.length > 0) {
    reasoning.push(`${warnings.length} warning(s) reduced score by ${warningPenalty}%`);
  }

  return {
    result,
    score: Math.round(adjustedScore),
    reasoning: reasoning.join('. '),
    canProceed: result === GATE_RESULTS.PASS,
    details: {
      rawScore: Math.round(score),
      criteriaScore: Math.round(criteriaScore),
      weightedScore: Math.round(weightedScore),
      confidencePenalty: Math.round(confidencePenalty),
      warningPenalty,
      finalScore: Math.round(adjustedScore),
      threshold,
    },
  };
}

/**
 * Get the minimum passing score for an agent's gate.
 * Different agents have different thresholds.
 * @param {string} agentName
 * @returns {number} Minimum score (0-100)
 */
export function getGateThreshold(agentName) {
  return GATE_THRESHOLDS[agentName] || GATE_THRESHOLDS._default;
}

/**
 * Check if gate result allows pipeline to continue.
 * @param {string} result - GATE_RESULTS value
 * @param {string} executionMode - 'autonomous' | 'human-in-the-loop'
 * @returns {{ proceed: boolean, action: string }}
 */
export function resolveGateAction(result, executionMode) {
  if (result === GATE_RESULTS.PASS) {
    return {
      proceed: true,
      action: 'continue',
    };
  }

  if (result === GATE_RESULTS.FAIL) {
    return {
      proceed: false,
      action: executionMode === 'autonomous' ? 'pause_for_review' : 'wait_for_user',
    };
  }

  // REVIEW result
  if (executionMode === 'autonomous') {
    return {
      proceed: false,
      action: 'pause_for_review',
    };
  }

  return {
    proceed: false,
    action: 'wait_for_user',
  };
}

/**
 * Get gate evaluation history.
 * @param {string} projectDir
 * @returns {object[]}
 */
export function getGateHistory(projectDir) {
  const result = loadSession(projectDir);
  if (!result.loaded || !result.session) {
    return [];
  }
  return result.session.gate_evaluations || [];
}

/**
 * Record a gate evaluation.
 * @param {string} projectDir
 * @param {object} evaluation
 */
export function recordGateEvaluation(projectDir, evaluation) {
  const result = loadSession(projectDir);

  if (!result.loaded || !result.session) {
    return;
  }

  const gate_evaluations = result.session.gate_evaluations || [];
  gate_evaluations.push({
    ...evaluation,
    timestamp: new Date().toISOString(),
  });

  updateSession(projectDir, { gate_evaluations });
}

/**
 * Get gate statistics.
 * @param {string} projectDir
 * @returns {{ total: number, passed: number, failed: number, reviewed: number, passRate: number }}
 */
export function getGateStatistics(projectDir) {
  const history = getGateHistory(projectDir);

  const stats = {
    total: history.length,
    passed: 0,
    failed: 0,
    reviewed: 0,
  };

  history.forEach(evaluation => {
    if (evaluation.result === GATE_RESULTS.PASS) {
      stats.passed++;
    } else if (evaluation.result === GATE_RESULTS.FAIL) {
      stats.failed++;
    } else if (evaluation.result === GATE_RESULTS.REVIEW) {
      stats.reviewed++;
    }
  });

  stats.passRate = stats.total > 0
    ? Math.round((stats.passed / stats.total) * 100)
    : 0;

  return stats;
}

/**
 * Get agent-specific gate statistics.
 * @param {string} projectDir
 * @param {string} agentName
 * @returns {{ total: number, passed: number, failed: number, reviewed: number, averageScore: number }}
 */
export function getAgentGateStatistics(projectDir, agentName) {
  const history = getGateHistory(projectDir);
  const agentEvaluations = history.filter(e => e.agent === agentName);

  const stats = {
    total: agentEvaluations.length,
    passed: 0,
    failed: 0,
    reviewed: 0,
    averageScore: 0,
  };

  if (stats.total === 0) {
    return stats;
  }

  let totalScore = 0;

  agentEvaluations.forEach(evaluation => {
    if (evaluation.result === GATE_RESULTS.PASS) {
      stats.passed++;
    } else if (evaluation.result === GATE_RESULTS.FAIL) {
      stats.failed++;
    } else if (evaluation.result === GATE_RESULTS.REVIEW) {
      stats.reviewed++;
    }

    totalScore += evaluation.score || 0;
  });

  stats.averageScore = Math.round(totalScore / stats.total);

  return stats;
}

/**
 * Clear gate evaluation history.
 * @param {string} projectDir
 * @returns {{ cleared: number }}
 */
export function clearGateHistory(projectDir) {
  const result = loadSession(projectDir);
  if (!result.loaded || !result.session) {
    return { cleared: 0 };
  }

  const count = result.session.gate_evaluations?.length || 0;

  updateSession(projectDir, { gate_evaluations: [] });

  return { cleared: count };
}
