/**
 * @fileoverview Circuit Breaker pattern for quality gate evaluation.
 *
 * Prevents repeated failures from consuming resources by tracking
 * consecutive failures and temporarily stopping execution.
 *
 * States:
 *   CLOSED   — Normal operation, requests flow through
 *   OPEN     — Failures exceeded threshold, requests rejected immediately
 *   HALF_OPEN — After reset timeout, allows a single test request
 */

export const CIRCUIT_STATES = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN',
};

export class CircuitBreaker {
  /**
   * @param {object} [options]
   * @param {number} [options.failureThreshold=3] - Consecutive failures before opening
   * @param {number} [options.resetTimeout=60000] - Milliseconds before trying recovery
   */
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold ?? 3;
    this.resetTimeout = options.resetTimeout ?? 60000;

    this._state = CIRCUIT_STATES.CLOSED;
    this._failures = 0;
    this._successes = 0;
    this._lastFailure = null;
    this._lastSuccess = null;
  }

  /**
   * Execute a function through the circuit breaker.
   *
   * @param {Function} fn - Function to execute (may be async)
   * @returns {*} Result from fn
   * @throws {Error} If circuit is OPEN and timeout has not elapsed
   */
  execute(fn) {
    if (this._state === CIRCUIT_STATES.OPEN) {
      // Check if reset timeout has elapsed
      const elapsed = Date.now() - (this._lastFailure || 0);
      if (elapsed >= this.resetTimeout) {
        this._state = CIRCUIT_STATES.HALF_OPEN;
      } else {
        throw new Error('Circuit breaker is OPEN. Request rejected.');
      }
    }

    try {
      const result = fn();
      this._onSuccess();
      return result;
    } catch (error) {
      this._onFailure();
      throw error;
    }
  }

  /** @private */
  _onSuccess() {
    this._successes++;
    this._lastSuccess = Date.now();

    if (this._state === CIRCUIT_STATES.HALF_OPEN) {
      // Recovery confirmed — close the circuit
      this._state = CIRCUIT_STATES.CLOSED;
      this._failures = 0;
    }
  }

  /** @private */
  _onFailure() {
    this._failures++;
    this._lastFailure = Date.now();

    if (this._state === CIRCUIT_STATES.HALF_OPEN) {
      // Recovery failed — reopen
      this._state = CIRCUIT_STATES.OPEN;
    } else if (this._failures >= this.failureThreshold) {
      this._state = CIRCUIT_STATES.OPEN;
    }
  }

  /**
   * Get current circuit state.
   * @returns {'CLOSED' | 'OPEN' | 'HALF_OPEN'}
   */
  getState() {
    return this._state;
  }

  /**
   * Get circuit statistics.
   * @returns {{ state: string, failures: number, successes: number, lastFailure: number|null, lastSuccess: number|null }}
   */
  getStats() {
    return {
      state: this._state,
      failures: this._failures,
      successes: this._successes,
      lastFailure: this._lastFailure,
      lastSuccess: this._lastSuccess,
    };
  }

  /**
   * Manually reset the circuit breaker to CLOSED state.
   */
  reset() {
    this._state = CIRCUIT_STATES.CLOSED;
    this._failures = 0;
    this._lastFailure = null;
  }
}
