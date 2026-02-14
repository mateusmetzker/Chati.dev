/**
 * @fileoverview Tests for terminal/monitor module.
 *
 * Uses mock terminal handles (no real processes).
 * Avoids setInterval by calling _pollOnce directly.
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { TerminalMonitor } from '../../src/terminal/monitor.js';

/**
 * Helper: create a mock terminal handle.
 */
function mockHandle(overrides = {}) {
  return {
    id: overrides.id || `mock-${Date.now()}`,
    process: overrides.process || null,
    agent: overrides.agent || 'test-agent',
    taskId: overrides.taskId || 'test-task',
    startedAt: overrides.startedAt || new Date().toISOString(),
    status: overrides.status || 'running',
    exitCode: overrides.exitCode ?? null,
    stdout: overrides.stdout || [],
    stderr: overrides.stderr || [],
    timeout: overrides.timeout || 300_000,
  };
}

describe('TerminalMonitor', () => {
  describe('addTerminal / removeTerminal', () => {
    it('should add a terminal', () => {
      const monitor = new TerminalMonitor();
      const handle = mockHandle({ id: 'term-1' });
      monitor.addTerminal(handle);
      const status = monitor.getStatus();
      assert.equal(status.active.length, 1);
      assert.equal(status.active[0].id, 'term-1');
    });

    it('should throw on invalid handle', () => {
      const monitor = new TerminalMonitor();
      assert.throws(() => monitor.addTerminal(null), /valid terminal handle/);
      assert.throws(() => monitor.addTerminal({}), /valid terminal handle/);
    });

    it('should remove a terminal', () => {
      const monitor = new TerminalMonitor();
      monitor.addTerminal(mockHandle({ id: 'term-2' }));
      const removed = monitor.removeTerminal('term-2');
      assert.equal(removed, true);
      assert.equal(monitor.getStatus().active.length, 0);
    });

    it('should return false when removing non-existent terminal', () => {
      const monitor = new TerminalMonitor();
      assert.equal(monitor.removeTerminal('nope'), false);
    });
  });

  describe('getStatus', () => {
    it('should categorise active, completed, and failed terminals', () => {
      const monitor = new TerminalMonitor();
      monitor.addTerminal(mockHandle({ id: 'a1', status: 'running' }));
      monitor.addTerminal(mockHandle({ id: 'a2', status: 'exited', exitCode: 0 }));
      monitor.addTerminal(mockHandle({ id: 'a3', status: 'exited', exitCode: 1 }));

      const status = monitor.getStatus();
      assert.equal(status.active.length, 1);
      assert.equal(status.completed.length, 1);
      assert.equal(status.failed.length, 1);
      assert.ok(status.elapsed >= 0);
    });
  });

  describe('isAllComplete', () => {
    it('should return true when no terminals registered', () => {
      const monitor = new TerminalMonitor();
      assert.equal(monitor.isAllComplete(), true);
    });

    it('should return false when a terminal is still running', () => {
      const monitor = new TerminalMonitor();
      monitor.addTerminal(mockHandle({ id: 'r1', status: 'running' }));
      assert.equal(monitor.isAllComplete(), false);
    });

    it('should return true when all terminals have exited', () => {
      const monitor = new TerminalMonitor();
      monitor.addTerminal(mockHandle({ id: 'e1', status: 'exited', exitCode: 0 }));
      monitor.addTerminal(mockHandle({ id: 'e2', status: 'killed', exitCode: -1 }));
      assert.equal(monitor.isAllComplete(), true);
    });
  });

  describe('getFailedTerminals', () => {
    it('should return terminals with non-zero exit codes', () => {
      const monitor = new TerminalMonitor();
      monitor.addTerminal(mockHandle({ id: 'ok', status: 'exited', exitCode: 0 }));
      monitor.addTerminal(mockHandle({ id: 'fail', status: 'exited', exitCode: 1 }));
      monitor.addTerminal(mockHandle({ id: 'run', status: 'running' }));

      const failed = monitor.getFailedTerminals();
      assert.equal(failed.length, 1);
      assert.equal(failed[0].id, 'fail');
    });

    it('should return empty array when all succeeded', () => {
      const monitor = new TerminalMonitor();
      monitor.addTerminal(mockHandle({ id: 'ok1', status: 'exited', exitCode: 0 }));
      assert.equal(monitor.getFailedTerminals().length, 0);
    });
  });

  describe('_checkTimeout', () => {
    it('should mark a terminal as timed-out when elapsed exceeds timeout', () => {
      const monitor = new TerminalMonitor({ timeout: 1000 });
      const handle = mockHandle({
        id: 'slow',
        status: 'running',
        startedAt: new Date(Date.now() - 5000).toISOString(),
        timeout: 1000,
      });

      monitor._checkTimeout(handle);
      assert.equal(handle.status, 'exited');
      assert.equal(handle.exitCode, -2);
      assert.ok(handle.stderr.some(s => s.includes('timed out')));
    });

    it('should not touch a terminal that is within timeout', () => {
      const monitor = new TerminalMonitor({ timeout: 300000 });
      const handle = mockHandle({
        id: 'fast',
        status: 'running',
        startedAt: new Date().toISOString(),
        timeout: 300000,
      });

      monitor._checkTimeout(handle);
      assert.equal(handle.status, 'running');
      assert.equal(handle.exitCode, null);
    });
  });

  describe('_pollOnce', () => {
    it('should detect exited terminals and fire progress callbacks', () => {
      const monitor = new TerminalMonitor();
      const handle = mockHandle({ id: 'poll-1', status: 'running' });
      monitor.addTerminal(handle);

      // Simulate that the process has exited
      handle.status = 'exited';
      handle.exitCode = 0;

      let progressCalled = false;
      monitor.onProgress(() => { progressCalled = true; });

      monitor._pollOnce();
      assert.equal(progressCalled, true);
    });

    it('should fire failure callbacks for failed terminals', () => {
      const monitor = new TerminalMonitor();
      const handle = mockHandle({
        id: 'poll-fail',
        status: 'running',
        startedAt: new Date(Date.now() - 500000).toISOString(),
        timeout: 1000,
      });
      monitor.addTerminal(handle);

      const failures = [];
      monitor.onFailure((h) => failures.push(h.id));

      monitor._pollOnce();

      // Terminal should be timed out (failed)
      assert.equal(handle.status, 'exited');
      assert.equal(failures.length, 1);
      assert.equal(failures[0], 'poll-fail');
    });

    it('should fire completion callbacks when all done', () => {
      const monitor = new TerminalMonitor();
      const handle = mockHandle({ id: 'poll-done', status: 'exited', exitCode: 0 });
      monitor.addTerminal(handle);

      let completeCalled = false;
      monitor.onComplete(() => { completeCalled = true; });

      monitor._pollOnce();
      assert.equal(completeCalled, true);
    });
  });

  describe('startMonitoring / stopMonitoring', () => {
    it('should start and stop without error', () => {
      const monitor = new TerminalMonitor({ pollInterval: 50 });
      monitor.startMonitoring();
      assert.ok(monitor._timer !== null);
      monitor.stopMonitoring();
      assert.equal(monitor._timer, null);
    });

    it('should be idempotent (double start / double stop)', () => {
      const monitor = new TerminalMonitor({ pollInterval: 50 });
      monitor.startMonitoring();
      const timer1 = monitor._timer;
      monitor.startMonitoring(); // should not replace
      assert.equal(monitor._timer, timer1);
      monitor.stopMonitoring();
      monitor.stopMonitoring(); // should not throw
      assert.equal(monitor._timer, null);
    });

    after(() => {
      // Safety: ensure no leaked intervals
    });
  });

  describe('callback registration', () => {
    it('should ignore non-function callbacks', () => {
      const monitor = new TerminalMonitor();
      monitor.onComplete('not a function');
      monitor.onFailure(123);
      monitor.onProgress(null);
      // No error thrown
      assert.ok(true);
    });
  });
});
