/**
 * @fileoverview Result collector for multi-terminal parallel execution.
 *
 * After a group of terminals completes, this module gathers their
 * outputs, merges handoff documents, builds a consolidated handoff
 * for the next sequential agent, and validates that everything
 * expected was produced.
 */

import { getWriteScope } from './isolation.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Collect structured results from every terminal in a completed group.
 *
 * @param {string} groupId - The group identifier
 * @param {import('./spawner.js').TerminalHandle[]} terminals
 * @returns {{ groupId: string, results: object[], summary: object }}
 */
export function collectResults(groupId, terminals) {
  if (!Array.isArray(terminals)) {
    return {
      groupId: groupId || 'unknown',
      results: [],
      summary: { total: 0, succeeded: 0, failed: 0 },
    };
  }

  const results = terminals.map(t => ({
    terminalId: t.id,
    agent: t.agent,
    taskId: t.taskId,
    status: t.exitCode === 0 ? 'success' : 'failed',
    exitCode: t.exitCode,
    stdout: (t.stdout || []).join(''),
    stderr: (t.stderr || []).join(''),
    startedAt: t.startedAt,
    elapsed: Date.now() - new Date(t.startedAt).getTime(),
  }));

  const succeeded = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'failed').length;

  return {
    groupId,
    results,
    summary: { total: results.length, succeeded, failed },
  };
}

/**
 * Merge handoff data from multiple parallel agent results into a single
 * consolidated structure.
 *
 * Each result is expected to contain handoff-like fields:
 *   { agent, outputs[], decisions{}, blockers[], summary }
 *
 * @param {object[]} results - Per-terminal result objects (from collectResults)
 * @returns {{ merged: boolean, outputs: string[], decisions: Record<string,string>, blockers: string[], summary: string }}
 */
export function mergeHandoffs(results) {
  if (!Array.isArray(results) || results.length === 0) {
    return {
      merged: false,
      outputs: [],
      decisions: {},
      blockers: [],
      summary: 'No results to merge.',
    };
  }

  const outputs = [];
  const decisions = {};
  const blockers = [];
  const summaries = [];

  for (const result of results) {
    // Gather outputs -- either explicit or inferred from write scopes
    if (Array.isArray(result.outputs)) {
      outputs.push(...result.outputs);
    } else {
      const scope = getWriteScope(result.agent);
      if (scope.length > 0) {
        outputs.push(...scope.map(s => `${result.agent}: ${s}`));
      }
    }

    // Merge decisions (keyed by agent to avoid collisions)
    if (result.decisions && typeof result.decisions === 'object') {
      for (const [key, val] of Object.entries(result.decisions)) {
        decisions[`${result.agent}.${key}`] = val;
      }
    }

    // Aggregate blockers
    if (Array.isArray(result.blockers)) {
      blockers.push(...result.blockers);
    }

    // Collect summaries
    if (result.summary) {
      summaries.push(`[${result.agent}] ${result.summary}`);
    } else {
      summaries.push(`[${result.agent}] ${result.status === 'success' ? 'Completed' : 'Failed'}`);
    }
  }

  return {
    merged: true,
    outputs,
    decisions,
    blockers,
    summary: summaries.join('\n'),
  };
}

/**
 * Build a single consolidated handoff document suitable for passing to
 * the next sequential agent.
 *
 * The format mirrors the handoff structure used in ../tasks/handoff.js.
 *
 * @param {object} mergedData - Output of mergeHandoffs
 * @param {string} nextAgent  - Name of the receiving agent
 * @returns {object} Handoff document
 */
export function buildConsolidatedHandoff(mergedData, nextAgent) {
  if (!mergedData) {
    return {
      from: { agent: 'parallel-group', task_id: 'parallel', phase: 'unknown' },
      to: nextAgent || null,
      timestamp: new Date().toISOString(),
      status: 'partial',
      score: null,
      summary: 'No data available.',
      outputs: [],
      decisions: {},
      blockers: [],
      criteria_met: [],
      criteria_unmet: [],
    };
  }

  const hasBlockers = (mergedData.blockers || []).length > 0;

  return {
    from: {
      agent: 'parallel-group',
      task_id: 'parallel',
      phase: 'parallel',
    },
    to: nextAgent || null,
    timestamp: new Date().toISOString(),
    status: hasBlockers ? 'partial' : 'complete',
    score: null,
    summary: mergedData.summary || 'Parallel execution completed.',
    outputs: mergedData.outputs || [],
    decisions: mergedData.decisions || {},
    blockers: mergedData.blockers || [],
    criteria_met: [],
    criteria_unmet: [],
  };
}

/**
 * Validate that all expected results are present and no write scope
 * violations occurred.
 *
 * @param {object[]} results - Per-terminal result objects
 * @returns {{ valid: boolean, missing: string[], errors: string[] }}
 */
export function validateResults(results) {
  const missing = [];
  const errors = [];

  if (!Array.isArray(results)) {
    return { valid: false, missing: ['results array'], errors: ['results is not an array'] };
  }

  for (const result of results) {
    // Check for missing required fields
    if (!result.terminalId) {
      missing.push('terminalId');
    }
    if (!result.agent) {
      missing.push(`agent for terminal ${result.terminalId || 'unknown'}`);
    }
    if (!result.taskId) {
      missing.push(`taskId for terminal ${result.terminalId || 'unknown'}`);
    }

    // Check exit status
    if (result.status === 'failed') {
      errors.push(
        `Terminal ${result.terminalId || 'unknown'} (${result.agent || 'unknown'}) failed ` +
        `with exit code ${result.exitCode}`
      );
    }

    // Check for write scope violations in stderr
    if (result.stderr && result.stderr.includes('CHATI_WRITE_SCOPE')) {
      errors.push(
        `Possible write scope violation in ${result.agent || 'unknown'}: ${result.stderr.slice(0, 200)}`
      );
    }
  }

  return {
    valid: missing.length === 0 && errors.length === 0,
    missing,
    errors,
  };
}
