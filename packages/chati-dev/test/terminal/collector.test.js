/**
 * @fileoverview Tests for terminal/collector module
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  collectResults,
  mergeHandoffs,
  buildConsolidatedHandoff,
  validateResults,
} from '../../src/terminal/collector.js';

/**
 * Helper: build a mock completed terminal handle.
 */
function mockTerminal(overrides = {}) {
  return {
    id: overrides.id || 'mock-term-1',
    agent: overrides.agent || 'architect',
    taskId: overrides.taskId || 'design-api',
    status: overrides.status || 'exited',
    exitCode: overrides.exitCode ?? 0,
    stdout: overrides.stdout || ['design complete\n'],
    stderr: overrides.stderr || [],
    startedAt: overrides.startedAt || new Date(Date.now() - 3000).toISOString(),
  };
}

describe('collector', () => {
  describe('collectResults', () => {
    it('should collect results from completed terminals', () => {
      const terminals = [
        mockTerminal({ id: 't1', agent: 'architect', exitCode: 0 }),
        mockTerminal({ id: 't2', agent: 'ux', exitCode: 0 }),
      ];

      const { groupId, results, summary } = collectResults('g1', terminals);

      assert.equal(groupId, 'g1');
      assert.equal(results.length, 2);
      assert.equal(summary.total, 2);
      assert.equal(summary.succeeded, 2);
      assert.equal(summary.failed, 0);
    });

    it('should categorise failed terminals', () => {
      const terminals = [
        mockTerminal({ id: 't1', exitCode: 0 }),
        mockTerminal({ id: 't2', exitCode: 1 }),
      ];

      const { summary } = collectResults('g2', terminals);
      assert.equal(summary.succeeded, 1);
      assert.equal(summary.failed, 1);
    });

    it('should include stdout and stderr in results', () => {
      const terminals = [
        mockTerminal({
          id: 't1',
          stdout: ['line1\n', 'line2\n'],
          stderr: ['warn: foo\n'],
        }),
      ];

      const { results } = collectResults('g3', terminals);
      assert.ok(results[0].stdout.includes('line1'));
      assert.ok(results[0].stderr.includes('warn'));
    });

    it('should handle null/invalid terminals', () => {
      const { results, summary } = collectResults('empty', null);
      assert.equal(results.length, 0);
      assert.equal(summary.total, 0);
    });
  });

  describe('mergeHandoffs', () => {
    it('should merge outputs, decisions, and blockers', () => {
      const results = [
        {
          agent: 'architect',
          status: 'success',
          outputs: ['architecture.yaml'],
          decisions: { pattern: 'microservices' },
          blockers: [],
          summary: 'Architecture done.',
        },
        {
          agent: 'ux',
          status: 'success',
          outputs: ['wireframes.pdf'],
          decisions: { framework: 'React' },
          blockers: ['Missing brand guide'],
          summary: 'UX done.',
        },
      ];

      const merged = mergeHandoffs(results);
      assert.equal(merged.merged, true);
      assert.deepEqual(merged.outputs, ['architecture.yaml', 'wireframes.pdf']);
      assert.equal(merged.decisions['architect.pattern'], 'microservices');
      assert.equal(merged.decisions['ux.framework'], 'React');
      assert.deepEqual(merged.blockers, ['Missing brand guide']);
      assert.ok(merged.summary.includes('[architect]'));
      assert.ok(merged.summary.includes('[ux]'));
    });

    it('should infer outputs from write scopes when not provided', () => {
      const results = [{ agent: 'architect', status: 'success' }];
      const merged = mergeHandoffs(results);
      assert.ok(merged.outputs.length > 0);
      assert.ok(merged.outputs[0].includes('architect'));
    });

    it('should handle empty results', () => {
      const merged = mergeHandoffs([]);
      assert.equal(merged.merged, false);
      assert.equal(merged.outputs.length, 0);
    });

    it('should handle null input', () => {
      const merged = mergeHandoffs(null);
      assert.equal(merged.merged, false);
    });
  });

  describe('buildConsolidatedHandoff', () => {
    it('should build a handoff document for the next agent', () => {
      const mergedData = {
        outputs: ['arch.yaml', 'ux.yaml'],
        decisions: { 'architect.pattern': 'modular' },
        blockers: [],
        summary: 'All parallel work done.',
      };

      const handoff = buildConsolidatedHandoff(mergedData, 'phases');
      assert.equal(handoff.from.agent, 'parallel-group');
      assert.equal(handoff.to, 'phases');
      assert.equal(handoff.status, 'complete');
      assert.ok(handoff.timestamp);
      assert.deepEqual(handoff.outputs, ['arch.yaml', 'ux.yaml']);
      assert.ok(handoff.summary.includes('parallel'));
    });

    it('should mark status as partial when blockers exist', () => {
      const mergedData = {
        outputs: [],
        decisions: {},
        blockers: ['Missing API spec'],
        summary: 'Blocked.',
      };

      const handoff = buildConsolidatedHandoff(mergedData, 'tasks');
      assert.equal(handoff.status, 'partial');
      assert.deepEqual(handoff.blockers, ['Missing API spec']);
    });

    it('should handle null mergedData', () => {
      const handoff = buildConsolidatedHandoff(null, 'dev');
      assert.equal(handoff.status, 'partial');
      assert.equal(handoff.to, 'dev');
      assert.ok(handoff.summary.includes('No data'));
    });

    it('should handle missing nextAgent', () => {
      const handoff = buildConsolidatedHandoff({ outputs: [], decisions: {}, blockers: [], summary: 'ok' });
      assert.equal(handoff.to, null);
    });
  });

  describe('validateResults', () => {
    it('should pass for valid, successful results', () => {
      const results = [
        { terminalId: 't1', agent: 'architect', taskId: 'design', status: 'success', exitCode: 0, stderr: '' },
        { terminalId: 't2', agent: 'ux', taskId: 'wireframe', status: 'success', exitCode: 0, stderr: '' },
      ];

      const validation = validateResults(results);
      assert.equal(validation.valid, true);
      assert.equal(validation.missing.length, 0);
      assert.equal(validation.errors.length, 0);
    });

    it('should report failed terminals as errors', () => {
      const results = [
        { terminalId: 't1', agent: 'architect', taskId: 'design', status: 'failed', exitCode: 1, stderr: '' },
      ];

      const validation = validateResults(results);
      assert.equal(validation.valid, false);
      assert.ok(validation.errors.length > 0);
      assert.ok(validation.errors[0].includes('failed'));
    });

    it('should report missing fields', () => {
      const results = [
        { status: 'success', exitCode: 0, stderr: '' },
      ];

      const validation = validateResults(results);
      assert.equal(validation.valid, false);
      assert.ok(validation.missing.length > 0);
    });

    it('should detect write scope violations in stderr', () => {
      const results = [
        {
          terminalId: 't1',
          agent: 'architect',
          taskId: 'design',
          status: 'success',
          exitCode: 0,
          stderr: 'Error: CHATI_WRITE_SCOPE violation: attempted write to src/index.js',
        },
      ];

      const validation = validateResults(results);
      assert.equal(validation.valid, false);
      assert.ok(validation.errors.some(e => e.includes('write scope violation')));
    });

    it('should handle non-array input', () => {
      const validation = validateResults(null);
      assert.equal(validation.valid, false);
      assert.ok(validation.errors.length > 0);
    });
  });
});
