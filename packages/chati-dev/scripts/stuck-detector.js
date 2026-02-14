/**
 * StuckDetector — Detects stalled execution patterns.
 *
 * Identifies consecutive failures, circular approaches, and stall timeouts
 * to trigger escalation before wasting further resources.
 *
 * @module scripts/stuck-detector
 */

/**
 * @typedef {Object} Attempt
 * @property {string} taskId
 * @property {string} agent
 * @property {string} approach
 * @property {boolean} success
 * @property {number} timestamp
 * @property {string} [error]
 */

/**
 * @typedef {Object} StuckResult
 * @property {boolean} stuck
 * @property {string} reason
 * @property {Object} evidence
 */

/**
 * @typedef {Object} CircularResult
 * @property {boolean} circular
 * @property {string[]} pattern
 */

/**
 * @typedef {Object} EscalationContext
 * @property {Attempt[]} history
 * @property {number} failureCount
 * @property {string[]} approaches
 * @property {string} suggestion
 */

/**
 * @typedef {Object} Stats
 * @property {number} totalAttempts
 * @property {number} failures
 * @property {number} successRate
 * @property {number} averageDuration
 */

export class StuckDetector {
  /**
   * @param {Object} [options]
   * @param {number} [options.maxConsecutiveFailures=3]
   * @param {number} [options.circularWindow=10]
   * @param {number} [options.stallTimeout=300000]
   */
  constructor(options = {}) {
    this.maxConsecutiveFailures = options.maxConsecutiveFailures ?? 3;
    this.circularWindow = options.circularWindow ?? 10;
    this.stallTimeout = options.stallTimeout ?? 300000; // 5 minutes
    /** @type {Attempt[]} */
    this.attempts = [];
  }

  /**
   * Records an execution attempt.
   * @param {Attempt} attempt
   */
  recordAttempt(attempt) {
    if (!attempt || typeof attempt !== 'object') {
      throw new Error('Attempt must be a non-null object');
    }
    if (!attempt.taskId || typeof attempt.taskId !== 'string') {
      throw new Error('Attempt must have a string taskId');
    }
    if (!attempt.agent || typeof attempt.agent !== 'string') {
      throw new Error('Attempt must have a string agent');
    }
    if (!attempt.approach || typeof attempt.approach !== 'string') {
      throw new Error('Attempt must have a string approach');
    }
    if (typeof attempt.success !== 'boolean') {
      throw new Error('Attempt must have a boolean success');
    }

    this.attempts.push({
      taskId: attempt.taskId,
      agent: attempt.agent,
      approach: attempt.approach,
      success: attempt.success,
      timestamp: attempt.timestamp ?? Date.now(),
      error: attempt.error ?? null,
    });
  }

  /**
   * Checks whether execution is stuck.
   * Evaluates: consecutive failures, circular approaches, stall timeout.
   * @returns {StuckResult}
   */
  isStuck() {
    if (this.attempts.length === 0) {
      return { stuck: false, reason: 'No attempts recorded', evidence: {} };
    }

    // --- Check consecutive failures ---
    const consecutiveFailures = this._countConsecutiveFailures();
    if (consecutiveFailures >= this.maxConsecutiveFailures) {
      const failedAttempts = this.attempts.slice(-consecutiveFailures);
      return {
        stuck: true,
        reason: `${consecutiveFailures} consecutive failures detected`,
        evidence: {
          type: 'consecutive_failures',
          count: consecutiveFailures,
          attempts: failedAttempts.map((a) => ({
            taskId: a.taskId,
            agent: a.agent,
            approach: a.approach,
            error: a.error,
          })),
        },
      };
    }

    // --- Check circular approaches ---
    const recentAttempts = this.attempts.slice(-this.circularWindow);
    const circular = this.detectCircularApproach(recentAttempts);
    if (circular.circular) {
      return {
        stuck: true,
        reason: `Circular approach pattern detected: ${circular.pattern.join(' -> ')}`,
        evidence: {
          type: 'circular_approach',
          pattern: circular.pattern,
          window: recentAttempts.length,
        },
      };
    }

    // --- Check stall timeout ---
    const stallResult = this._checkStallTimeout();
    if (stallResult.stalled) {
      return {
        stuck: true,
        reason: `Execution stalled for ${Math.round(stallResult.duration / 1000)}s without success`,
        evidence: {
          type: 'stall_timeout',
          duration: stallResult.duration,
          threshold: this.stallTimeout,
          lastSuccess: stallResult.lastSuccessTimestamp,
        },
      };
    }

    return { stuck: false, reason: 'Execution proceeding normally', evidence: {} };
  }

  /**
   * Detects if the same approaches are being tried repeatedly (A->B->A->B).
   * @param {Attempt[]} attempts
   * @returns {CircularResult}
   */
  detectCircularApproach(attempts) {
    if (!attempts || attempts.length < 4) {
      return { circular: false, pattern: [] };
    }

    const approaches = attempts.map((a) => a.approach);

    // Try pattern lengths from 2 to half the window
    const maxPatternLen = Math.floor(approaches.length / 2);
    for (let patternLen = 2; patternLen <= maxPatternLen; patternLen++) {
      const candidate = approaches.slice(0, patternLen);
      let repeats = 0;
      let matched = true;

      for (let i = 0; i < approaches.length; i++) {
        if (approaches[i] !== candidate[i % patternLen]) {
          matched = false;
          break;
        }
        if (i > 0 && i % patternLen === 0) {
          repeats++;
        }
      }

      // Need at least 2 full repetitions to count as circular
      if (matched && repeats >= 2) {
        return { circular: true, pattern: candidate };
      }
    }

    // Also check for trailing repetition pattern (recent attempts form a cycle)
    for (let patternLen = 2; patternLen <= maxPatternLen; patternLen++) {
      const tail = approaches.slice(-patternLen * 2);
      if (tail.length < patternLen * 2) continue;

      const firstHalf = tail.slice(0, patternLen);
      const secondHalf = tail.slice(patternLen);
      const isRepeat = firstHalf.every((val, idx) => val === secondHalf[idx]);

      if (isRepeat) {
        return { circular: true, pattern: firstHalf };
      }
    }

    return { circular: false, pattern: [] };
  }

  /**
   * Builds context for escalation to a human operator.
   * @returns {EscalationContext}
   */
  getEscalationContext() {
    const failures = this.attempts.filter((a) => !a.success);
    const uniqueApproaches = [...new Set(this.attempts.map((a) => a.approach))];

    let suggestion = 'Review recent failures and consider an alternative strategy.';

    if (failures.length > 0) {
      const errorMessages = failures
        .filter((f) => f.error)
        .map((f) => f.error);
      const uniqueErrors = [...new Set(errorMessages)];

      if (uniqueErrors.length === 1) {
        suggestion = `All failures share the same error: "${uniqueErrors[0]}". Investigate this specific root cause.`;
      } else if (uniqueApproaches.length <= 2 && failures.length >= 3) {
        suggestion =
          'Only 1-2 approaches have been tried. Consider a fundamentally different approach.';
      } else if (failures.length === this.attempts.length) {
        suggestion =
          'No successful attempts at all. The task may need re-scoping or prerequisite work.';
      }
    }

    return {
      history: [...this.attempts],
      failureCount: failures.length,
      approaches: uniqueApproaches,
      suggestion,
    };
  }

  /**
   * Clears all recorded attempts.
   */
  reset() {
    this.attempts = [];
  }

  /**
   * Returns aggregate statistics about recorded attempts.
   * @returns {Stats}
   */
  getStats() {
    const total = this.attempts.length;
    if (total === 0) {
      return { totalAttempts: 0, failures: 0, successRate: 0, averageDuration: 0 };
    }

    const failures = this.attempts.filter((a) => !a.success).length;
    const successRate = ((total - failures) / total) * 100;

    // Calculate average duration between consecutive attempts
    let totalDuration = 0;
    let durationCount = 0;
    for (let i = 1; i < this.attempts.length; i++) {
      const diff = this.attempts[i].timestamp - this.attempts[i - 1].timestamp;
      if (diff > 0) {
        totalDuration += diff;
        durationCount++;
      }
    }
    const averageDuration = durationCount > 0 ? totalDuration / durationCount : 0;

    return {
      totalAttempts: total,
      failures,
      successRate: Math.round(successRate * 100) / 100,
      averageDuration: Math.round(averageDuration),
    };
  }

  // ── Private helpers ──────────────────────────────────────────

  /**
   * Counts consecutive failures from the most recent attempt backward.
   * @returns {number}
   * @private
   */
  _countConsecutiveFailures() {
    let count = 0;
    for (let i = this.attempts.length - 1; i >= 0; i--) {
      if (!this.attempts[i].success) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }

  /**
   * Checks if execution has stalled (no success within stallTimeout).
   * @returns {{ stalled: boolean, duration: number, lastSuccessTimestamp: number|null }}
   * @private
   */
  _checkStallTimeout() {
    const now = Date.now();
    const successes = this.attempts.filter((a) => a.success);
    const lastSuccessTimestamp =
      successes.length > 0 ? successes[successes.length - 1].timestamp : null;

    // If we have never succeeded, measure from first attempt
    const referenceTime = lastSuccessTimestamp ?? this.attempts[0]?.timestamp ?? now;
    const duration = now - referenceTime;

    // Only consider stalled if there are recent failures after reference
    const attemptsAfterRef = this.attempts.filter((a) => a.timestamp > referenceTime);
    const hasRecentFailures = attemptsAfterRef.some((a) => !a.success);

    return {
      stalled: duration >= this.stallTimeout && (hasRecentFailures || !lastSuccessTimestamp),
      duration,
      lastSuccessTimestamp,
    };
  }
}

/**
 * Convenience: creates a StuckDetector and evaluates a batch of attempts.
 * @param {Attempt[]} attempts
 * @param {Object} [options]
 * @returns {StuckResult}
 */
export function evaluateAttempts(attempts, options = {}) {
  const detector = new StuckDetector(options);
  for (const attempt of attempts) {
    detector.recordAttempt(attempt);
  }
  return detector.isStuck();
}
