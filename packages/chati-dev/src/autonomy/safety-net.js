/**
 * @fileoverview Safety net for autonomous execution
 * Auto-pauses pipeline on dangerous conditions
 */

/**
 * Safety conditions that trigger automatic pause.
 */
export const SAFETY_TRIGGERS = {
  CONSECUTIVE_FAILURES: 'consecutive_failures', // 3+ failures in a row
  LOW_SCORE: 'low_score', // Score < 70%
  CRITICAL_RISK: 'critical_risk', // Security/data risk detected
  TIMEOUT: 'timeout', // Agent exceeded time limit
  GOTCHA_SPIKE: 'gotcha_spike', // 5+ new gotchas in current session
};

// Critical risk keywords
const CRITICAL_RISK_KEYWORDS = [
  'security',
  'vulnerability',
  'exploit',
  'injection',
  'authentication',
  'authorization',
  'data loss',
  'data corruption',
  'production',
  'database drop',
  'rm -rf',
  'delete all',
];

/**
 * Check all safety conditions against current state.
 * @param {object} state
 * @param {number} state.consecutiveFailures - Number of consecutive gate failures
 * @param {number} state.lastScore - Most recent gate score
 * @param {string[]} state.riskFlags - Active risk flags
 * @param {number} state.sessionGotchas - New gotchas this session
 * @param {number} [state.agentDurationMs] - Time current agent has been running
 * @param {number} [state.timeoutMs] - Maximum allowed duration
 * @returns {{ safe: boolean, triggers: object[], recommendation: string }}
 */
export function checkSafety(state) {
  const triggers = [];

  // Check each trigger
  Object.values(SAFETY_TRIGGERS).forEach(trigger => {
    const result = evaluateTrigger(trigger, state);
    if (result.triggered) {
      triggers.push(result);
    }
  });

  const safe = triggers.length === 0;
  const recommendation = safe
    ? 'All safety checks passed'
    : getRecommendedAction(triggers).reason;

  return {
    safe,
    triggers,
    recommendation,
  };
}

/**
 * Evaluate a single safety condition.
 * @param {string} trigger - SAFETY_TRIGGERS value
 * @param {object} state
 * @returns {{ triggered: boolean, severity: 'warning'|'critical', details: string }}
 */
export function evaluateTrigger(trigger, state) {
  switch (trigger) {
    case SAFETY_TRIGGERS.CONSECUTIVE_FAILURES:
      return evaluateConsecutiveFailures(state);

    case SAFETY_TRIGGERS.LOW_SCORE:
      return evaluateLowScore(state);

    case SAFETY_TRIGGERS.CRITICAL_RISK:
      return evaluateCriticalRisk(state);

    case SAFETY_TRIGGERS.TIMEOUT:
      return evaluateTimeout(state);

    case SAFETY_TRIGGERS.GOTCHA_SPIKE:
      return evaluateGotchaSpike(state);

    default:
      return {
        triggered: false,
        severity: 'warning',
        details: 'Unknown trigger',
      };
  }
}

/**
 * Get recommended action when safety net triggers.
 * @param {object[]} triggers - Triggered safety conditions
 * @returns {{ action: 'pause'|'warn'|'abort', reason: string, resumable: boolean }}
 */
export function getRecommendedAction(triggers) {
  if (triggers.length === 0) {
    return {
      action: 'warn',
      reason: 'No safety triggers detected',
      resumable: true,
    };
  }

  // Check for critical severity
  const hasCritical = triggers.some(t => t.severity === 'critical');

  if (hasCritical) {
    const criticalTriggers = triggers.filter(t => t.severity === 'critical');
    return {
      action: 'pause',
      reason: `Critical safety conditions: ${criticalTriggers.map(t => t.details).join('; ')}`,
      resumable: true,
    };
  }

  // Only warnings
  return {
    action: 'warn',
    reason: `Safety warnings: ${triggers.map(t => t.details).join('; ')}`,
    resumable: true,
  };
}

/**
 * Evaluate consecutive failures trigger.
 * @param {object} state
 * @returns {{ triggered: boolean, severity: string, details: string }}
 */
function evaluateConsecutiveFailures(state) {
  const threshold = 3;
  const failures = state.consecutiveFailures || 0;

  if (failures >= threshold) {
    return {
      triggered: true,
      severity: 'critical',
      details: `${failures} consecutive gate failures (threshold: ${threshold})`,
    };
  }

  return {
    triggered: false,
    severity: 'warning',
    details: 'No consecutive failures',
  };
}

/**
 * Evaluate low score trigger.
 * @param {object} state
 * @returns {{ triggered: boolean, severity: string, details: string }}
 */
function evaluateLowScore(state) {
  const threshold = 70;
  const score = state.lastScore;

  if (typeof score !== 'number') {
    return {
      triggered: false,
      severity: 'warning',
      details: 'No score available',
    };
  }

  if (score < threshold) {
    return {
      triggered: true,
      severity: 'warning',
      details: `Low quality score: ${score}% (threshold: ${threshold}%)`,
    };
  }

  return {
    triggered: false,
    severity: 'warning',
    details: 'Score within acceptable range',
  };
}

/**
 * Evaluate critical risk trigger.
 * @param {object} state
 * @returns {{ triggered: boolean, severity: string, details: string }}
 */
function evaluateCriticalRisk(state) {
  const riskFlags = state.riskFlags || [];

  // Check for critical risk keywords
  const criticalFlags = riskFlags.filter(flag =>
    CRITICAL_RISK_KEYWORDS.some(keyword =>
      flag.toLowerCase().includes(keyword.toLowerCase())
    )
  );

  if (criticalFlags.length > 0) {
    return {
      triggered: true,
      severity: 'critical',
      details: `Critical risks detected: ${criticalFlags.join(', ')}`,
    };
  }

  return {
    triggered: false,
    severity: 'warning',
    details: 'No critical risks detected',
  };
}

/**
 * Evaluate timeout trigger.
 * @param {object} state
 * @returns {{ triggered: boolean, severity: string, details: string }}
 */
function evaluateTimeout(state) {
  const { agentDurationMs, timeoutMs } = state;

  if (typeof agentDurationMs !== 'number' || typeof timeoutMs !== 'number') {
    return {
      triggered: false,
      severity: 'warning',
      details: 'No timeout configured',
    };
  }

  if (agentDurationMs >= timeoutMs) {
    const minutes = Math.round(agentDurationMs / 60000);
    const maxMinutes = Math.round(timeoutMs / 60000);
    return {
      triggered: true,
      severity: 'critical',
      details: `Agent timeout: ${minutes}min (max: ${maxMinutes}min)`,
    };
  }

  return {
    triggered: false,
    severity: 'warning',
    details: 'Agent within time limits',
  };
}

/**
 * Evaluate gotcha spike trigger.
 * @param {object} state
 * @returns {{ triggered: boolean, severity: string, details: string }}
 */
function evaluateGotchaSpike(state) {
  const threshold = 5;
  const gotchas = state.sessionGotchas || 0;

  if (gotchas >= threshold) {
    return {
      triggered: true,
      severity: 'warning',
      details: `High gotcha count: ${gotchas} (threshold: ${threshold})`,
    };
  }

  return {
    triggered: false,
    severity: 'warning',
    details: 'Gotcha count within limits',
  };
}

/**
 * Get critical risk keywords list.
 * @returns {string[]}
 */
export function getCriticalRiskKeywords() {
  return [...CRITICAL_RISK_KEYWORDS];
}

/**
 * Check if a risk flag contains critical keywords.
 * @param {string} flag
 * @returns {boolean}
 */
export function isCriticalRisk(flag) {
  return CRITICAL_RISK_KEYWORDS.some(keyword =>
    flag.toLowerCase().includes(keyword.toLowerCase())
  );
}

/**
 * Build safety report for user.
 * @param {object} state
 * @returns {{ status: string, message: string, triggers: object[] }}
 */
export function buildSafetyReport(state) {
  const result = checkSafety(state);

  let status;
  let message;

  if (result.safe) {
    status = 'safe';
    message = 'All safety checks passed. Pipeline can continue.';
  } else {
    const action = getRecommendedAction(result.triggers);
    status = action.action === 'pause' ? 'unsafe' : 'warning';
    message = action.reason;
  }

  return {
    status,
    message,
    triggers: result.triggers,
  };
}
