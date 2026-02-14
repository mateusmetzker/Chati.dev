/**
 * @fileoverview Terminal monitor for multi-agent parallel execution.
 *
 * Tracks the lifecycle of every spawned terminal through a polling
 * loop and event-based callbacks.  Detects completion, failure,
 * and timeout conditions and notifies registered listeners.
 */

import { getTerminalStatus } from './spawner.js';

/**
 * Monitors a set of active terminal handles, providing
 * aggregated status, completion detection and timeout enforcement.
 */
export class TerminalMonitor {
  /**
   * @param {object} [options]
   * @param {number} [options.pollInterval=2000] - Polling interval in ms
   * @param {number} [options.timeout=300000]    - Default terminal timeout in ms
   */
  constructor(options = {}) {
    /** @type {number} */
    this.pollInterval = options.pollInterval ?? 2000;

    /** @type {number} */
    this.defaultTimeout = options.timeout ?? 300_000;

    /** @type {Map<string, import('./spawner.js').TerminalHandle>} */
    this._terminals = new Map();

    /** @type {NodeJS.Timeout|null} */
    this._timer = null;

    /** @type {string} */
    this._startedAt = new Date().toISOString();

    // Callbacks
    /** @type {Function[]} */
    this._onComplete = [];
    /** @type {Function[]} */
    this._onFailure = [];
    /** @type {Function[]} */
    this._onProgress = [];
  }

  // -------------------------------------------------------------------
  // Registration
  // -------------------------------------------------------------------

  /**
   * Register a terminal handle for monitoring.
   *
   * @param {import('./spawner.js').TerminalHandle} handle
   */
  addTerminal(handle) {
    if (!handle || !handle.id) {
      throw new Error('addTerminal requires a valid terminal handle with an id');
    }
    this._terminals.set(handle.id, handle);
  }

  /**
   * Un-register a terminal from monitoring.
   *
   * @param {string} terminalId
   * @returns {boolean} True if the terminal was found and removed.
   */
  removeTerminal(terminalId) {
    return this._terminals.delete(terminalId);
  }

  // -------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------

  /**
   * Begin the monitoring poll loop.
   */
  startMonitoring() {
    if (this._timer) return; // already running
    this._startedAt = new Date().toISOString();
    this._timer = setInterval(() => this._pollOnce(), this.pollInterval);
  }

  /**
   * Stop the monitoring poll loop.
   */
  stopMonitoring() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  // -------------------------------------------------------------------
  // Status queries
  // -------------------------------------------------------------------

  /**
   * Return the aggregated status of every monitored terminal.
   *
   * @returns {{ active: object[], completed: object[], failed: object[], elapsed: number }}
   */
  getStatus() {
    const active = [];
    const completed = [];
    const failed = [];

    for (const handle of this._terminals.values()) {
      const status = getTerminalStatus(handle);

      if (handle.status === 'running') {
        active.push(status);
      } else if (handle.exitCode === 0) {
        completed.push(status);
      } else {
        failed.push(status);
      }
    }

    const elapsed = Date.now() - new Date(this._startedAt).getTime();
    return { active, completed, failed, elapsed };
  }

  /**
   * True when every registered terminal has finished (exited or killed).
   *
   * @returns {boolean}
   */
  isAllComplete() {
    if (this._terminals.size === 0) return true;

    for (const handle of this._terminals.values()) {
      if (handle.status === 'running') return false;
    }
    return true;
  }

  /**
   * Return handles for all terminals that exited with a non-zero code.
   *
   * @returns {import('./spawner.js').TerminalHandle[]}
   */
  getFailedTerminals() {
    const failed = [];
    for (const handle of this._terminals.values()) {
      if (handle.status !== 'running' && handle.exitCode !== 0) {
        failed.push(handle);
      }
    }
    return failed;
  }

  // -------------------------------------------------------------------
  // Callback registration
  // -------------------------------------------------------------------

  /**
   * Register a callback invoked when ALL terminals have completed.
   *
   * @param {Function} callback - Receives the aggregated status object.
   */
  onComplete(callback) {
    if (typeof callback === 'function') {
      this._onComplete.push(callback);
    }
  }

  /**
   * Register a callback invoked when any terminal fails.
   *
   * @param {Function} callback - Receives the failed terminal handle.
   */
  onFailure(callback) {
    if (typeof callback === 'function') {
      this._onFailure.push(callback);
    }
  }

  /**
   * Register a callback invoked on each poll tick with the current status.
   *
   * @param {Function} callback - Receives the aggregated status object.
   */
  onProgress(callback) {
    if (typeof callback === 'function') {
      this._onProgress.push(callback);
    }
  }

  // -------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------

  /**
   * Execute a single poll iteration.
   * Checks every terminal for exit, failure or timeout.
   */
  _pollOnce() {
    const justFailed = [];

    for (const handle of this._terminals.values()) {
      if (handle.status !== 'running') continue;

      // Check timeout
      this._checkTimeout(handle);

      // Detect exit via exitCode being set (process 'exit' event already fired)
      if (handle.status !== 'running') {
        this._handleTerminalExit(handle.id, handle.exitCode);
        if (handle.exitCode !== 0) {
          justFailed.push(handle);
        }
      }
    }

    // Notify progress listeners
    const status = this.getStatus();
    for (const cb of this._onProgress) {
      try { cb(status); } catch { /* consumer error -- swallow */ }
    }

    // Notify failure listeners
    for (const handle of justFailed) {
      for (const cb of this._onFailure) {
        try { cb(handle); } catch { /* consumer error -- swallow */ }
      }
    }

    // Notify completion listeners
    if (this.isAllComplete() && this._terminals.size > 0) {
      this.stopMonitoring();
      for (const cb of this._onComplete) {
        try { cb(status); } catch { /* consumer error -- swallow */ }
      }
    }
  }

  /**
   * Process a terminal exit event.
   *
   * @param {string} terminalId
   * @param {number|null} exitCode
   */
  _handleTerminalExit(terminalId, exitCode) {
    const handle = this._terminals.get(terminalId);
    if (!handle) return;

    if (handle.status === 'running') {
      handle.status = 'exited';
      handle.exitCode = exitCode;
    }
  }

  /**
   * Check whether a terminal has exceeded its timeout.
   * If it has, mark it as timed-out (exitCode -2) and kill the process
   * if one exists.
   *
   * @param {import('./spawner.js').TerminalHandle} handle
   */
  _checkTimeout(handle) {
    const timeout = handle.timeout || this.defaultTimeout;
    const elapsed = Date.now() - new Date(handle.startedAt).getTime();

    if (elapsed >= timeout) {
      handle.status = 'exited';
      handle.exitCode = -2; // sentinel for timeout
      handle.stderr.push(`Terminal timed out after ${Math.round(elapsed / 1000)}s`);

      // Attempt to kill the actual process
      if (handle.process && typeof handle.process.kill === 'function') {
        try { handle.process.kill('SIGKILL'); } catch { /* ignore */ }
      }
    }
  }
}
