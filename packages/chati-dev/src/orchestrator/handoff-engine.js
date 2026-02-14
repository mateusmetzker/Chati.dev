/**
 * Handoff Engine — Manages agent-to-agent transitions with context preservation.
 *
 * This module orchestrates the handoff process between agents, ensuring
 * critical context is preserved, validated, and properly transferred.
 */

import { buildHandoff, saveHandoff, loadHandoff } from '../tasks/handoff.js';
import { readAgentMemory } from '../memory/agent-memory.js';
import { getRelevantGotchas } from '../memory/gotchas.js';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Execute a full agent-to-agent handoff.
 *
 * @param {string} projectDir
 * @param {object} params
 * @param {object} params.fromTask - Completed task definition
 * @param {object} params.validation - Task validation results
 * @param {string[]} params.outputs - Produced artifact paths
 * @param {object} params.decisions - Key decisions made
 * @param {string} params.summary - Human-readable summary
 * @param {string[]} [params.blockers] - Unresolved issues
 * @returns {{ success: boolean, handoff: object, savedPath: string|null, errors: string[] }}
 */
export function executeHandoff(projectDir, params) {
  const errors = [];

  // Validate preconditions
  const preconditions = validateHandoffPreconditions(params);
  if (!preconditions.valid) {
    return {
      success: false,
      handoff: null,
      savedPath: null,
      errors: preconditions.issues,
    };
  }

  try {
    // Build the handoff document
    // Transform params to match buildHandoff signature
    const handoffParams = {
      task: params.fromTask,
      validation: params.validation,
      outputs: params.outputs,
      decisions: params.decisions,
      summary: params.summary,
      blockers: params.blockers,
    };

    const handoff = buildHandoff(handoffParams);

    // Save to disk
    const saveResult = saveHandoff(projectDir, handoff);

    if (!saveResult.saved) {
      errors.push(saveResult.error);
      return {
        success: false,
        handoff,
        savedPath: null,
        errors,
      };
    }

    return {
      success: true,
      handoff,
      savedPath: saveResult.path,
      errors: [],
    };
  } catch (err) {
    errors.push(`Failed to execute handoff: ${err.message}`);
    return {
      success: false,
      handoff: null,
      savedPath: null,
      errors,
    };
  }
}

/**
 * Validate preconditions for a handoff to proceed.
 * Checks: validation passed, required outputs exist, no critical blockers.
 *
 * @param {object} params
 * @returns {{ valid: boolean, issues: string[] }}
 */
export function validateHandoffPreconditions(params) {
  const issues = [];

  // Check validation exists and passed
  if (!params.validation) {
    issues.push('Validation results are required for handoff');
  } else if (!params.validation.valid) {
    issues.push('Task validation must pass before handoff');
  }

  // Check required outputs
  if (!params.outputs || params.outputs.length === 0) {
    if (params.fromTask.outputs && params.fromTask.outputs.length > 0) {
      issues.push('Task declares outputs but none were provided');
    }
  }

  // Check for critical blockers
  if (params.blockers && params.blockers.length > 0) {
    const hasCritical = params.blockers.some(b =>
      b.toLowerCase().includes('critical') ||
      b.toLowerCase().includes('blocking') ||
      b.toLowerCase().includes('cannot proceed')
    );

    if (hasCritical) {
      issues.push('Critical blockers must be resolved before handoff');
    }
  }

  // Check summary provided
  if (!params.summary || params.summary.trim().length === 0) {
    issues.push('Handoff summary is required');
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Load context from previous agent for the receiving agent.
 * Combines: handoff document + relevant agent memories + gotchas.
 *
 * @param {string} projectDir
 * @param {string} fromAgent - Agent that sent the handoff
 * @returns {{ context: object, sources: string[] }}
 */
export function loadHandoffContext(projectDir, fromAgent) {
  const sources = [];
  const context = {
    handoff: null,
    memories: [],
    gotchas: [],
  };

  // Load handoff document
  const handoffResult = loadHandoff(projectDir, fromAgent);
  if (handoffResult.loaded) {
    context.handoff = handoffResult.handoff;
    sources.push(`handoff from ${fromAgent}`);
  }

  // Load agent memories
  const memoryResult = readAgentMemory(projectDir, fromAgent);
  if (memoryResult.loaded && memoryResult.entries.length > 0) {
    context.memories = memoryResult.entries.filter(
      e => e.confidence === 'high' || e.confidence === 'medium'
    );
    sources.push(`${context.memories.length} memory entries from ${fromAgent}`);
  }

  // Load relevant gotchas
  const gotchas = getRelevantGotchas(projectDir, {
    agent: fromAgent,
    task: context.handoff?.from_task || null,
  });

  if (gotchas.length > 0) {
    context.gotchas = gotchas.slice(0, 5); // Top 5 most relevant
    sources.push(`${context.gotchas.length} relevant gotchas`);
  }

  return {
    context,
    sources,
  };
}

/**
 * Get handoff history (all handoffs in order).
 * @param {string} projectDir
 * @returns {object[]} Array of handoff summaries
 */
export function getHandoffHistory(projectDir) {
  const handoffsDir = join(projectDir, 'chati.dev', 'artifacts', 'handoffs');

  if (!existsSync(handoffsDir)) {
    return [];
  }

  try {
    const files = readdirSync(handoffsDir)
      .filter(f => f.endsWith('-handoff.md'))
      .map(f => {
        const agentName = f.replace('-handoff.md', '');
        const result = loadHandoff(projectDir, agentName);

        if (!result.loaded) {
          return null;
        }

        return {
          agent: agentName,
          to: result.handoff.to,
          timestamp: result.handoff.timestamp,
          status: result.handoff.status,
          score: result.handoff.score,
          summary: result.handoff.summary,
        };
      })
      .filter(Boolean);

    // Sort by timestamp
    files.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    return files;
  } catch {
    return [];
  }
}

/**
 * Check if rollback to a previous agent is possible.
 * @param {string} projectDir
 * @param {string} targetAgent - Agent to rollback to
 * @returns {{ possible: boolean, reason: string, affectedAgents: string[] }}
 */
export function checkRollbackFeasibility(projectDir, targetAgent) {
  const history = getHandoffHistory(projectDir);

  if (history.length === 0) {
    return {
      possible: false,
      reason: 'No handoff history available',
      affectedAgents: [],
    };
  }

  // Find target agent in history
  const targetIndex = history.findIndex(h => h.agent === targetAgent);

  if (targetIndex === -1) {
    return {
      possible: false,
      reason: `Agent '${targetAgent}' has not completed any handoffs yet`,
      affectedAgents: [],
    };
  }

  // Get agents that completed after target
  const affectedAgents = history
    .slice(targetIndex + 1)
    .map(h => h.agent);

  if (affectedAgents.length === 0) {
    return {
      possible: false,
      reason: `Agent '${targetAgent}' is already the most recent completed agent`,
      affectedAgents: [],
    };
  }

  return {
    possible: true,
    reason: `Rollback will undo work from ${affectedAgents.length} agent(s)`,
    affectedAgents,
  };
}
