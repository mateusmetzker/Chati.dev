/**
 * Task Router — Maps orchestrator intents to the correct task definition.
 *
 * The router is used internally by the orchestrator to determine
 * which task an agent should execute based on:
 * - Current pipeline position
 * - Agent state
 * - User intent signals
 */

import { loadAllTasks, getAgentTasks } from './loader.js';

/**
 * Task Router instance.
 * Holds the loaded task registry and provides routing methods.
 */
export class TaskRouter {
  /**
   * @param {string} tasksDir - Path to chati.dev/tasks/
   */
  constructor(tasksDir) {
    this.tasksDir = tasksDir;
    this.taskMap = new Map();
    this.errors = [];
    this.loaded = false;
  }

  /**
   * Initialize the router by loading all task definitions.
   * @returns {this}
   */
  load() {
    const result = loadAllTasks(this.tasksDir);
    this.taskMap = result.tasks;
    this.errors = result.errors;
    this.loaded = true;
    return this;
  }

  /**
   * Route to the correct task for an agent at a given pipeline position.
   *
   * Routing priority:
   * 1. Exact task ID match (if provided)
   * 2. Agent's consolidate task (if pipeline position = consolidate)
   * 3. Agent's first non-consolidate task (default entry point)
   *
   * @param {object} intent
   * @param {string} intent.agent - Target agent name
   * @param {string} [intent.taskId] - Explicit task ID (highest priority)
   * @param {string} [intent.action] - Action keyword (e.g., 'consolidate', 'extract')
   * @param {string} [intent.phase] - Pipeline phase filter
   * @returns {{ found: boolean, task: object|null, reason: string }}
   */
  route(intent) {
    if (!this.loaded) {
      return { found: false, task: null, reason: 'Router not loaded. Call load() first.' };
    }

    if (!intent || !intent.agent) {
      return { found: false, task: null, reason: 'No agent specified in routing intent.' };
    }

    // 1. Exact task ID match
    if (intent.taskId) {
      const task = this.taskMap.get(intent.taskId);
      if (task) {
        return { found: true, task, reason: `Exact match: ${intent.taskId}` };
      }
      return { found: false, task: null, reason: `Task ID '${intent.taskId}' not found in registry.` };
    }

    // Get all tasks for this agent
    const agentTasks = getAgentTasks(this.taskMap, intent.agent);
    if (agentTasks.length === 0) {
      return { found: false, task: null, reason: `No tasks registered for agent '${intent.agent}'.` };
    }

    // Filter by phase if provided
    let candidates = agentTasks;
    if (intent.phase) {
      const phaseFiltered = agentTasks.filter(t => t.phase === intent.phase);
      if (phaseFiltered.length > 0) {
        candidates = phaseFiltered;
      }
    }

    // 2. Action keyword match
    if (intent.action) {
      const actionTask = candidates.find(t =>
        t.id.includes(intent.action) || t.id.endsWith(`-${intent.action}`)
      );
      if (actionTask) {
        return { found: true, task: actionTask, reason: `Action match: ${intent.action}` };
      }
    }

    // 3. Consolidate task (if action is consolidate or implied)
    if (intent.action === 'consolidate') {
      const consolidateTask = candidates.find(t => t.id.endsWith('-consolidate'));
      if (consolidateTask) {
        return { found: true, task: consolidateTask, reason: 'Consolidate task selected.' };
      }
    }

    // 4. Default: first non-consolidate task (entry point)
    const entryTask = candidates.find(t => !t.id.endsWith('-consolidate')) || candidates[0];
    return { found: true, task: entryTask, reason: `Default entry: ${entryTask.id}` };
  }

  /**
   * Get the next task in an agent's task sequence.
   * Uses the handoff_to field to determine chaining.
   *
   * @param {string} currentTaskId - Currently executing task ID
   * @returns {{ found: boolean, task: object|null, reason: string }}
   */
  getNextTask(currentTaskId) {
    const current = this.taskMap.get(currentTaskId);
    if (!current) {
      return { found: false, task: null, reason: `Current task '${currentTaskId}' not found.` };
    }

    // If handoff_to is an agent name, it means we switch agents (orchestrator handles this)
    // If handoff_to is a task ID within the same agent, it's internal chaining
    if (!current.handoff_to) {
      return { found: false, task: null, reason: 'No handoff defined for this task.' };
    }

    // Check if handoff_to is a task ID
    const nextTask = this.taskMap.get(current.handoff_to);
    if (nextTask) {
      return { found: true, task: nextTask, reason: `Internal chain: ${current.handoff_to}` };
    }

    // Otherwise it's an agent-level handoff (handled by orchestrator)
    return {
      found: false,
      task: null,
      reason: `Agent handoff to '${current.handoff_to}'. Orchestrator handles inter-agent routing.`,
    };
  }

  /**
   * Get all parallelizable tasks for a given agent.
   * @param {string} agentName
   * @returns {object[]}
   */
  getParallelTasks(agentName) {
    return getAgentTasks(this.taskMap, agentName).filter(t => t.parallelizable);
  }

  /**
   * Get routing statistics.
   * @returns {{ totalTasks: number, byAgent: object, byPhase: object, errors: number }}
   */
  getStats() {
    const byAgent = {};
    const byPhase = {};

    for (const task of this.taskMap.values()) {
      byAgent[task.agent] = (byAgent[task.agent] || 0) + 1;
      byPhase[task.phase] = (byPhase[task.phase] || 0) + 1;
    }

    return {
      totalTasks: this.taskMap.size,
      byAgent,
      byPhase,
      errors: this.errors.length,
    };
  }
}

/**
 * Create and load a TaskRouter instance.
 * @param {string} tasksDir - Path to chati.dev/tasks/
 * @returns {TaskRouter}
 */
export function createRouter(tasksDir) {
  return new TaskRouter(tasksDir).load();
}
