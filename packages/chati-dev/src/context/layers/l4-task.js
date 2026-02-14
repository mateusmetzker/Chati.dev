/**
 * L4 Task Layer — Active when a specific task is running.
 *
 * Injects task-specific context: the active task definition,
 * handoff data from the previous agent, and relevant artifacts.
 */

/**
 * Process L4: inject task context and handoff data.
 * @param {object} ctx - Pipeline context
 * @param {string} [ctx.taskId] - Active task ID (e.g. 'brief-extract')
 * @param {object} [ctx.handoff] - Handoff data from previous agent
 * @param {string[]} [ctx.artifacts] - List of artifact paths relevant to current task
 * @returns {{ layer: string, taskId: string|null, handoff: object, artifacts: string[] }}
 */
export function processL4(ctx) {
  return {
    layer: 'L4',
    taskId: ctx.taskId || null,
    handoff: ctx.handoff || {},
    artifacts: ctx.artifacts || [],
    criteria: ctx.taskCriteria || [],
  };
}
