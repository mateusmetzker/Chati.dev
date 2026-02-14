/**
 * L3 Workflow/Pipeline Layer — Active when session has pipeline state.
 *
 * Loads workflow rules with phase awareness: what came before,
 * what comes next, and constraints for the current pipeline position.
 */

import { loadWorkflowDomains, extractRules } from '../domain-loader.js';

/**
 * Process L3: load workflow rules with pipeline awareness.
 * @param {object} ctx - Pipeline context
 * @param {string} ctx.domainsDir - Path to chati.dev/domains/
 * @param {string} ctx.workflow - Active workflow name (e.g. 'greenfield-fullstack')
 * @param {string} ctx.pipelinePosition - Current position in pipeline (e.g. 'brief')
 * @returns {{ layer: string, workflow: string, rules: Array, pipelineContext: object }}
 */
export function processL3(ctx) {
  if (!ctx.workflow) {
    return { layer: 'L3', workflow: null, rules: [], pipelineContext: {} };
  }

  const allDomains = loadWorkflowDomains(ctx.domainsDir);
  const domain = allDomains.get(ctx.workflow) || null;
  const rules = extractRules(domain);

  const steps = domain?.steps || [];
  const currentIdx = steps.indexOf(ctx.pipelinePosition);

  return {
    layer: 'L3',
    workflow: ctx.workflow,
    rules,
    pipelineContext: {
      currentStep: ctx.pipelinePosition || null,
      previousStep: currentIdx > 0 ? steps[currentIdx - 1] : null,
      nextStep: currentIdx >= 0 && currentIdx < steps.length - 1 ? steps[currentIdx + 1] : null,
      totalSteps: steps.length,
      progress: steps.length > 0 ? Math.round(((currentIdx + 1) / steps.length) * 100) : 0,
    },
  };
}
